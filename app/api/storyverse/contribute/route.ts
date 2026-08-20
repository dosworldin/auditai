import { NextResponse } from "next/server";
import { requireAuth, deductCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/storyverse/contribute — Submit a contribution to a round.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { storyId, roundId, content } = body;

  if (!storyId || !roundId || !content?.trim()) {
    return NextResponse.json({ error: "storyId, roundId, and content are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Verify round exists and is open
  const { data: round } = await supabase
    .from("storyverse_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("story_id", storyId)
    .single();

  if (!round || round.status !== "OPEN") {
    return NextResponse.json({ error: "Round is not open for contributions" }, { status: 400 });
  }

  // Verify user is a contributor
  const { data: contributor } = await supabase
    .from("storyverse_contributors")
    .select("*")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .single();

  if (!contributor) {
    return NextResponse.json({ error: "You are not a contributor to this story" }, { status: 403 });
  }

  // Check if user already contributed to this round
  const { data: existing } = await supabase
    .from("storyverse_contributions")
    .select("id")
    .eq("round_id", roundId)
    .eq("author_id", user.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You have already contributed to this round" }, { status: 400 });
  }

  const wordCount = content.trim().split(/\s+/).length;

  // Create contribution
  const { data: contribution, error } = await supabase
    .from("storyverse_contributions")
    .insert({
      story_id: storyId,
      round_id: roundId,
      author_id: user.id,
      author_display_name: contributor.display_name,
      author_country: contributor.country,
      content: content.trim(),
      word_count: wordCount,
      status: "PENDING",
      votes: 0,
      is_canon: false,
      ai_polish_status: "none",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: "contribution_submitted",
    story_id: storyId,
    round_id: roundId,
    contribution_id: contribution.id,
    user_id: user.id,
    metadata: { wordCount },
  });

  return NextResponse.json({ contribution }, { status: 201 });
}

/**
 * POST /api/storyverse/contribute/vote — Cast a vote on a contribution.
 */
export async function PUT(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { contributionId, storyId, roundId, voteType = "free", tokenAmount = 0 } = body;

  if (!contributionId || !storyId || !roundId) {
    return NextResponse.json({ error: "contributionId, storyId, and roundId are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Check round is in voting status
  const { data: round } = await supabase
    .from("storyverse_rounds")
    .select("*")
    .eq("id", roundId)
    .single();

  if (!round || round.status !== "VOTING") {
    return NextResponse.json({ error: "Round is not in voting status" }, { status: 400 });
  }

  // Check if user already voted on this contribution
  const { data: existingVote } = await supabase
    .from("storyverse_votes")
    .select("id")
    .eq("contribution_id", contributionId)
    .eq("voter_id", user.id)
    .limit(1)
    .single();

  if (existingVote) {
    return NextResponse.json({ error: "You have already voted on this contribution" }, { status: 400 });
  }

  // Check self-voting
  const { data: contribution } = await supabase
    .from("storyverse_contributions")
    .select("author_id")
    .eq("id", contributionId)
    .single();

  if (contribution && contribution.author_id === user.id) {
    return NextResponse.json({ error: "You cannot vote for your own contribution" }, { status: 400 });
  }

  // For paid votes, deduct credits
  let creditsCost = 0;
  if (voteType === "paid") {
    // Get paid vote price from admin settings
    const { data: priceSetting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "storyverse_paid_vote_price")
      .single();

    creditsCost = Number(priceSetting?.value ?? 1);

    if ((user.profile.credits ?? 0) < creditsCost) {
      return NextResponse.json({ error: "Insufficient credits for paid vote" }, { status: 402 });
    }

    await deductCredits(user.id, creditsCost, "storyverse_charge", "Paid vote", contributionId, "storyverse_vote");
  }

  // Calculate weight (could be enhanced with trust/reputation)
  const weight = 1;

  // Create vote
  const { error: voteError } = await supabase
    .from("storyverse_votes")
    .insert({
      contribution_id: contributionId,
      story_id: storyId,
      round_id: roundId,
      voter_id: user.id,
      vote_type: voteType,
      weight,
      token_amount: voteType === "paid" ? creditsCost : null,
    });

  if (voteError) return NextResponse.json({ error: voteError.message }, { status: 500 });

  // Update contribution vote count
  const currentVotes = ((contribution as unknown as { votes?: number })?.votes ?? 0);
  await supabase
    .from("storyverse_contributions")
    .update({ votes: currentVotes + 1 })
    .eq("id", contributionId);

  // Log to ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: voteType === "paid" ? "paid_vote_cast" : "free_vote_cast",
    story_id: storyId,
    round_id: roundId,
    contribution_id: contributionId,
    user_id: user.id,
    metadata: { voteType, weight, creditsCost },
  });

  return NextResponse.json({ ok: true, voteType, creditsCost });
}
