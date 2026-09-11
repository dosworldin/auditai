import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth, deductCredits, addCredits } from "@/lib/auth/session";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { narratePage, VOICE_PROMPTS } from "@/lib/storybook/voice";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/storybook/[id]/voice — premium add-on: AI voice narration.
 *
 * Charges storybook_voice_credits ONCE per order (first successful run);
 * later calls are free top-ups for pages that are still missing audio.
 * Each page gets a warm narrated WAV stored in the private bucket, playable
 * in the flipbook and downloadable alongside the PDF.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`storybook-voice:${user.id}`, 4, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: { voice?: unknown } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { voice?: unknown };
  } catch {
    body = {};
  }
  const voice = typeof body.voice === "string" && body.voice in VOICE_PROMPTS ? body.voice : "Kore";

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, status, pages, voice_requested, voice_status, narration")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const row = order as {
    id: string;
    user_id: string;
    status: string;
    pages: { pageNumber: number; text?: string; narrationPath?: string | null }[];
    voice_requested: boolean;
    voice_status: string | null;
    narration: Record<string, unknown> | null;
  };

  if (row.status !== "ready") {
    return NextResponse.json(
      { error: "Voice narration is available once the storybook is ready." },
      { status: 409 },
    );
  }

  const settings = await getStorybookSettings();
  if (!settings.voiceEnabled) {
    return NextResponse.json(
      { error: "Voice narration is temporarily disabled by the administrator." },
      { status: 403 },
    );
  }

  // Charge once per order: first run (voice_requested false) costs credits.
  const firstRun = !row.voice_requested;
  if (firstRun && settings.voiceCredits > 0) {
    const charge = await deductCredits(
      user.id,
      settings.voiceCredits,
      "storybook_voice",
      `Voice narration (${row.id})`,
      row.id,
      "storybook_order",
    );
    if (!charge.ok) {
      return NextResponse.json(
        { error: `Voice narration costs ${settings.voiceCredits} credits: ${charge.error}` },
        { status: 402 },
      );
    }
  }

  const admin = await getSupabaseAdmin();
  const narrationMap: Record<string, string> = {};
  const existing = (row.narration ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(existing)) {
    if (typeof v === "string") narrationMap[k] = v;
  }

  try {
    const pages = (row.pages ?? [])
      .filter((p) => typeof p.text === "string" && (p.text ?? "").trim())
      .sort((a, b) => a.pageNumber - b.pageNumber);

    if (pages.length === 0) {
      throw new Error("No page text available to narrate.");
    }

    for (const p of pages) {
      if (narrationMap[String(p.pageNumber)]) continue; // already narrated
      const { wav } = await narratePage(p.text as string, voice);
      const path = `${row.user_id}/${row.id}/audio/p${p.pageNumber}.wav`;
      const { error: upErr } = await admin.storage
        .from("storybook-assets")
        .upload(path, wav, { contentType: "audio/wav", upsert: true });
      if (upErr) throw new Error(`Audio upload failed: ${upErr.message}`);
      narrationMap[String(p.pageNumber)] = path;
    }

    await (supabase as any)
      .from("storybook_orders")
      .update({
        voice_requested: true,
        voice_status: "ready",
        voice_name: voice,
        narration: narrationMap,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return NextResponse.json({ ok: true, narratedPages: Object.keys(narrationMap).length });
  } catch (err) {
    // Mark progress and refund on the first failed run so nobody pays twice.
    await (supabase as any)
      .from("storybook_orders")
      .update({
        voice_requested: firstRun,
        voice_status: firstRun ? "failed" : "partial",
        narration: narrationMap,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (firstRun && settings.voiceCredits > 0) {
      await addCredits(
        user.id,
        settings.voiceCredits,
        "storybook_voice_refund",
        `Refund: narration failed (${row.id})`,
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Narration failed" },
      { status: 502 },
    );
  }
}
