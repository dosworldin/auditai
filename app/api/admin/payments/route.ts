import { NextResponse } from "next/server";
import { requireAdmin, addCredits } from "@/lib/auth/session";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/db/supabase-server";
import { sendPaymentApprovedEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments — list manual payment requests (admin only).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const supabase = await getSupabaseAdmin();
  let query = supabase
    .from("payment_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user emails and generate signed URLs for proofs (15 min).
  const enriched = [];
  for (const row of data ?? []) {
    let email: string | null = null;
    let proofUrl: string | null = null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", row.user_id)
      .single();
    email = profile?.email ?? null;

    if (row.proof_storage_path) {
      const { data: signed } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(row.proof_storage_path, 900);
      proofUrl = signed?.signedUrl ?? null;
    }

    enriched.push({ ...row, email, proofUrl });
  }

  return NextResponse.json({ requests: enriched });
}

/**
 * PUT /api/admin/payments — approve or reject a manual payment request.
 * Approve: idempotently grants the credits via addCredits and records the ledger id.
 * Reject: marks rejected with an optional review note.
 */
export async function PUT(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { requestId, action, reviewNote } = body;

  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "requestId and action (approve|reject) are required" }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();

  const { data: paymentRequest, error: fetchError } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !paymentRequest) {
    return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
  }

  if (paymentRequest.status === "approved") {
    return NextResponse.json({ error: "Request already approved" }, { status: 409 });
  }
  if (paymentRequest.status === "rejected") {
    return NextResponse.json({ error: "Request already rejected" }, { status: 409 });
  }

  if (action === "reject") {
    const { error } = await supabase
      .from("payment_requests")
      .update({
        status: "rejected",
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote ? String(reviewNote).slice(0, 300) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // --- Approve: grant credits (idempotent guard on status) ---
  const { error: claimError } = await supabase
    .from("payment_requests")
    .update({
      status: "approved",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote ? String(reviewNote).slice(0, 300) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", paymentRequest.status); // only succeeds if status unchanged since read

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  // Double-check the claim won (guards concurrent approvals).
  const { data: verify } = await supabase
    .from("payment_requests")
    .select("status, reviewed_by")
    .eq("id", requestId)
    .single();

  if (!verify || verify.status !== "approved" || verify.reviewed_by !== admin.id) {
    return NextResponse.json({ error: "Request was modified by another review" }, { status: 409 });
  }

  const grant = await addCredits(
    paymentRequest.user_id,
    Number(paymentRequest.credits),
    "purchase",
    `Credit pack: ${paymentRequest.package_label ?? "custom"} (manual payment approved)`,
  );

  if (!grant.ok) {
    // Revert to submitted so it can be re-approved after fixing the failure.
    await supabase
      .from("payment_requests")
      .update({ status: "submitted", reviewed_by: null, reviewed_at: null })
      .eq("id", requestId);
    return NextResponse.json({ error: grant.error ?? "Failed to grant credits" }, { status: 500 });
  }

  // Email confirmation (best-effort; fails silently if Resend is not configured)
  try {
    const serverSupabase = await getSupabaseServer();
    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("email")
      .eq("id", paymentRequest.user_id)
      .single();
    if (profile?.email) {
      await sendPaymentApprovedEmail({
        to: profile.email,
        credits: Number(paymentRequest.credits),
        packageLabel: paymentRequest.package_label ?? null,
      });
    }
  } catch {
    // email is non-critical
  }

  return NextResponse.json({ ok: true, status: "approved", newBalance: grant.newBalance });
}
