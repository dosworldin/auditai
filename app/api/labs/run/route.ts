import { NextResponse } from "next/server";
import type { LabRunPayload } from "@/lib/engine/types";
import { runLab } from "@/lib/engine/labLogic";
import { getLab } from "@/lib/labs/registry";
import { requireAuth, deductCredits, checkPromotionUsage } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function validatePayload(body: unknown): { ok: true; payload: LabRunPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const labSlug = typeof b.labSlug === "string" ? b.labSlug.trim() : "";
  if (!labSlug) return { ok: false, error: "labSlug is required" };
  if (!getLab(labSlug)) {
    return { ok: false, error: `Unknown lab: ${labSlug}` };
  }
  const file = b.file;
  if (file && (typeof file !== "object" || file === null)) {
    return { ok: false, error: "file must be an object" };
  }
  const url = typeof b.url === "string" ? b.url : undefined;
  const text = typeof b.text === "string" ? b.text : undefined;
  const config =
    b.config && typeof b.config === "object" && !Array.isArray(b.config)
      ? (b.config as Record<string, string | number | boolean>)
      : undefined;

  const hasFile = file !== undefined;
  const hasUrl = Boolean(url && url.trim());
  const hasText = Boolean(text && text.trim());
  if (!hasFile && !hasUrl && !hasText) {
    return { ok: false, error: "Provide one of: file, url, or text" };
  }

  const payload: LabRunPayload = { labSlug, url, text, config };
  if (hasFile) {
    const f = file as Record<string, unknown>;
    if (typeof f.name !== "string" || typeof f.kind !== "string" || typeof f.base64 !== "string") {
      return { ok: false, error: "file must include name, kind, and base64" };
    }
    payload.file = { name: f.name, kind: f.kind, base64: f.base64 };
  }
  return { ok: true, payload };
}

export async function POST(request: Request) {
  // --- Authentication ---
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  // --- Validate payload ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validatePayload(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { payload } = validated;
  const labDef = getLab(payload.labSlug);

  // Coming Soon labs should not be processed
  if (labDef?.comingSoon) {
    return NextResponse.json(
      { error: "This lab is coming soon and not yet available." },
      { status: 400 },
    );
  }

  const creditsNeeded = 1; // Labs use 1 credit per run

  // --- Check credits or promotion ---
  let usedFreePromotion = false;
  const promo = await checkPromotionUsage(user.id, payload.labSlug);

  if (!promo.allowed) {
    if (user.profile.credits < creditsNeeded) {
      return NextResponse.json(
        { error: `Insufficient credits. Required: ${creditsNeeded}, Available: ${user.profile.credits}` },
        { status: 402 },
      );
    }
  } else {
    usedFreePromotion = true;
  }

  // --- Create lab request record ---
  const supabase = await getSupabaseServer();
  const { data: requestRecord, error: insertError } = await supabase
    .from("lab_requests")
    .insert({
      user_id: user.id,
      lab_slug: payload.labSlug,
      status: "processing",
      input_type: payload.file?.kind ?? payload.url ? "url" : "text",
      input_text: payload.text ?? null,
      config: payload.config ?? {},
    })
    .select("id")
    .single();

  if (insertError || !requestRecord) {
    return NextResponse.json({ error: "Failed to create lab request" }, { status: 500 });
  }

  // --- Deduct credits ---
  if (usedFreePromotion) {
    await supabase.from("credit_ledger").insert({
      user_id: user.id,
      event_type: "promotion_use",
      amount: 0,
      balance_after: user.profile.credits,
      description: `Free promotion use: ${labDef?.name ?? payload.labSlug}`,
      reference_id: requestRecord.id,
      reference_type: "lab_request",
    });
  } else {
    const deduction = await deductCredits(
      user.id,
      creditsNeeded,
      "lab_use",
      `Lab: ${labDef?.name ?? payload.labSlug}`,
      requestRecord.id,
      "lab_request",
    );
    if (!deduction.ok) {
      return NextResponse.json({ error: deduction.error }, { status: 500 });
    }
  }

  // --- Run the lab ---
  const startTime = Date.now();
  try {
    const output = await runLab(payload);
    const durationMs = Date.now() - startTime;

    // Save dream entries for dream analyzer
    if (payload.labSlug === "dream-ai-analyzer" && payload.text) {
      await supabase.from("dream_entries").insert({
        user_id: user.id,
        narrative: payload.text,
        symbols: output.findings.filter((f) => f.id.startsWith("sym-")).map((f) => f.label),
        emotions: output.findings.filter((f) => f.id.startsWith("emo-")).map((f) => f.label),
        themes: output.findings.filter((f) => f.id.startsWith("ctx-")).map((f) => f.label),
        country: (payload.config?.country as string) ?? null,
      });
    }

    // Update request record
    await supabase
      .from("lab_requests")
      .update({
        status: "completed",
        output_data: output as unknown as Record<string, unknown>,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRecord.id);

    return NextResponse.json(output, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Lab processing failed";

    await supabase
      .from("lab_requests")
      .update({
        status: "failed",
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRecord.id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
