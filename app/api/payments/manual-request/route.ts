import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { getPaymentGatewayConfig } from "@/lib/payments/config";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PROOF_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

/**
 * POST /api/payments/manual-request — create a manual payment request with
 * an uploaded payment proof (screenshot/PDF). Server validates gateway
 * availability (admin toggle + India-only rule), file type/size, and stores
 * the proof in the private payment-proofs storage bucket.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  // --- Rate limit: max 5 payment proof submissions per user per hour ---
  const rl = rateLimit(`payment-proof:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const config = await getPaymentGatewayConfig();
  if (!config.customEnabled) {
    return NextResponse.json({ error: "Custom gateway is disabled" }, { status: 403 });
  }

  const isIndia = (user.profile.country ?? "").trim().toLowerCase() === "india";
  if (config.customIndiaOnly && !isIndia) {
    return NextResponse.json({ error: "Custom gateway is only available in India" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const packageLabel = String(form.get("packageLabel") ?? "").trim();
  const credits = Number(form.get("credits"));
  const amount = Number(form.get("amount"));
  const referenceNote = String(form.get("referenceNote") ?? "").trim().slice(0, 200);
  const proof = form.get("proof");

  if (!packageLabel || !Number.isFinite(credits) || credits <= 0 || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "packageLabel, credits, and amount are required" }, { status: 400 });
  }

  if (!(proof instanceof File) || proof.size === 0) {
    return NextResponse.json({ error: "Payment proof file is required" }, { status: 400 });
  }

  if (proof.size > MAX_PROOF_BYTES) {
    return NextResponse.json({ error: "Proof file must be under 5 MB" }, { status: 400 });
  }

  if (!ALLOWED_PROOF_TYPES.has(proof.type)) {
    return NextResponse.json({ error: "Proof must be PNG, JPG, WEBP, or PDF" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Create the payment request first.
  const { data: paymentRequest, error: insertError } = await supabase
    .from("payment_requests")
    .insert({
      user_id: user.id,
      gateway: "custom",
      purpose: "credit_pack",
      package_label: packageLabel,
      credits,
      amount,
      currency: config.customCurrency,
      status: "submitted",
      reference_note: referenceNote || null,
    })
    .select("id")
    .single();

  if (insertError || !paymentRequest) {
    return NextResponse.json({ error: "Failed to create payment request" }, { status: 500 });
  }

  // Upload the proof to private storage under the user's own folder.
  const ext = proof.type === "application/pdf" ? "pdf" : proof.type.split("/")[1] ?? "bin";
  const storagePath = `${user.id}/${paymentRequest.id}.${ext}`;
  const fileBuffer = Buffer.from(await proof.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(storagePath, fileBuffer, {
      contentType: proof.type,
      upsert: false,
    });

  if (uploadError) {
    // Roll the request back to awaiting state without proof so admin can see it.
    await supabase
      .from("payment_requests")
      .update({ status: "awaiting_proof" })
      .eq("id", paymentRequest.id);
    return NextResponse.json(
      { error: "Payment request saved but proof upload failed. Please re-upload.", requestId: paymentRequest.id },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("payment_requests")
    .update({ proof_storage_path: storagePath, status: "submitted" })
    .eq("id", paymentRequest.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, requestId: paymentRequest.id, status: "submitted" },
    { status: 201 },
  );
}
