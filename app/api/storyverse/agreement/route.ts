import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

const CURRENT_VERSION = "1.0";
const AGREEMENT_TEXT = `By contributing to StoryVerse, I agree that:
- My contributions become part of a collaborative work governed by the platform's publishing rights.
- The platform may publish, distribute, and sell the collective work.
- I retain attribution and receive my fair share of author pool revenue per the frozen publication snapshot.
- I will not independently publish or distribute StoryVerse collective works while exclusivity is active.
- Revenue splits: Book sales 30% platform / 70% author pool. Paid voting 70% platform / 30% author pool.`;

/**
 * GET /api/storyverse/agreement — Check if user has accepted the current agreement.
 */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();
  const { data: agreement } = await supabase
    .from("storyverse_contributor_agreements")
    .select("*")
    .eq("user_id", user.id)
    .eq("accepted", true)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    hasAccepted: !!agreement,
    agreementVersion: agreement?.agreement_version ?? null,
    agreementText: AGREEMENT_TEXT,
    currentVersion: CURRENT_VERSION,
  });
}

/**
 * POST /api/storyverse/agreement — Accept the contributor agreement.
 */
export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();

  // Check if already accepted
  const { data: existing } = await supabase
    .from("storyverse_contributor_agreements")
    .select("id")
    .eq("user_id", user.id)
    .eq("accepted", true)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, message: "Agreement already accepted" });
  }

  const textHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(AGREEMENT_TEXT),
  ).then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

  const { error } = await supabase
    .from("storyverse_contributor_agreements")
    .insert({
      user_id: user.id,
      agreement_version: CURRENT_VERSION,
      agreement_text_hash: textHash,
      accepted: true,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: "agreement_accepted",
    user_id: user.id,
    metadata: { version: CURRENT_VERSION, textHash },
  });

  return NextResponse.json({ ok: true, message: "Agreement accepted" });
}
