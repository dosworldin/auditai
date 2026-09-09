import { NextResponse } from "next/server";
import type { AuditRunPayload } from "@/lib/engine/types";
import { runAudit } from "@/lib/engine/pipeline";
import { getToolLogic } from "@/lib/engine/toolLogic";
import { requireAuth, deductCredits, checkPromotionUsage } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { getTool } from "@/lib/tools/registry";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { resolveToolCredits, isToolDisabled } from "@/lib/pricing/tool-pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function validatePayload(body: unknown): { ok: true; payload: AuditRunPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const toolSlug = typeof b.toolSlug === "string" ? b.toolSlug.trim() : "";
  if (!toolSlug) return { ok: false, error: "toolSlug is required" };
  if (!getToolLogic(toolSlug)) {
    return { ok: false, error: `Unknown tool: ${toolSlug}` };
  }
  const file = b.file;
  if (file && (typeof file !== "object" || file === null)) {
    return { ok: false, error: "file must be an object" };
  }
  const url = typeof b.url === "string" ? b.url : undefined;
  const text = typeof b.text === "string" ? b.text : undefined;
  const documentName = typeof b.documentName === "string" ? b.documentName : undefined;
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

  const payload: AuditRunPayload = { toolSlug, documentName, url, text, config };
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

  // --- Rate limit (abuse guard for AI/extraction-heavy runs) ---
  const rl = rateLimit(`audit:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

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
  const toolDef = getTool(payload.toolSlug);

  // --- Admin tool on/off gate ---
  if (await isToolDisabled(payload.toolSlug)) {
    return NextResponse.json(
      { error: `"${toolDef?.name ?? payload.toolSlug}" is temporarily disabled by the administrator. Please try again later.` },
      { status: 403 },
    );
  }

  // Admin pricing override wins; registry pricing is the fallback.
  const creditsNeeded = await resolveToolCredits(
    payload.toolSlug,
    toolDef?.pricing.creditsPerRun ?? 1,
  );

  // --- Check credits or promotion ---
  let usedFreePromotion = false;
  const promo = await checkPromotionUsage(user.id, payload.toolSlug);

  if (!promo.allowed) {
    // Check credits
    if (user.profile.credits < creditsNeeded) {
      return NextResponse.json(
        { error: `Insufficient credits. Required: ${creditsNeeded}, Available: ${user.profile.credits}` },
        { status: 402 },
      );
    }
  } else {
    usedFreePromotion = true;
  }

  // --- Create audit request record ---
  const supabase = await getSupabaseServer();
  const { data: requestRecord, error: insertError } = await supabase
    .from("audit_requests")
    .insert({
      user_id: user.id,
      tool_slug: payload.toolSlug,
      tool_name: toolDef?.name ?? payload.toolSlug,
      document_name: payload.documentName ?? null,
      input_type: payload.file?.kind ?? payload.url ? "url" : "text",
      config: payload.config ?? {},
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError || !requestRecord) {
    return NextResponse.json({ error: "Failed to create audit request" }, { status: 500 });
  }

  // --- Deduct credits (or log promotion use) ---
  if (usedFreePromotion) {
    await supabase.from("credit_ledger").insert({
      user_id: user.id,
      event_type: "promotion_use",
      amount: 0,
      balance_after: user.profile.credits,
      description: `Free promotion use: ${toolDef?.name ?? payload.toolSlug}`,
      reference_id: requestRecord.id,
      reference_type: "audit_request",
    });
  } else {
    const deduction = await deductCredits(
      user.id,
      creditsNeeded,
      "tool_use",
      `Audit: ${toolDef?.name ?? payload.toolSlug}`,
      requestRecord.id,
      "audit_request",
    );
    if (!deduction.ok) {
      return NextResponse.json({ error: deduction.error }, { status: 500 });
    }
  }

  // --- Run the audit ---
  const startTime = Date.now();
  try {
    const report = await runAudit(payload);
    const durationMs = Date.now() - startTime;

    // --- Save report ---
    const severityCounts = report.findings.reduce(
      (acc, f) => {
        if (f.severity === "Critical") acc.criticalCount++;
        else if (f.severity === "High") acc.highCount++;
        else if (f.severity === "Medium") acc.mediumCount++;
        else acc.lowCount++;
        return acc;
      },
      { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
    );

    await supabase.from("audit_reports").insert({
      request_id: requestRecord.id,
      user_id: user.id,
      tool_slug: payload.toolSlug,
      tool_name: report.toolName,
      document_name: report.documentName,
      risk_score: report.riskScore,
      risk_label: report.riskLabel,
      summary: report.summary,
      report_data: report as unknown as Record<string, unknown>,
      findings_count: report.findings.length,
      critical_count: severityCounts.criticalCount,
      high_count: severityCounts.highCount,
      medium_count: severityCounts.mediumCount,
      low_count: severityCounts.lowCount,
    });

    // Update request status
    await supabase
      .from("audit_requests")
      .update({ status: report.status === "ok" ? "completed" : "failed", duration_ms: durationMs, completed_at: new Date().toISOString() })
      .eq("id", requestRecord.id);

    return NextResponse.json(report, { status: report.status === "ok" ? 200 : 404 });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Audit processing failed";

    await supabase
      .from("audit_requests")
      .update({ status: "failed", error_message: errorMessage, duration_ms: durationMs, completed_at: new Date().toISOString() })
      .eq("id", requestRecord.id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
