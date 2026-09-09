import { NextResponse } from "next/server";
import { requireAuth, deductCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { runAiEditor } from "@/lib/ai/aiEditor";

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

  // Check contributor agreement
  const { data: agreement } = await supabase
    .from("storyverse_contributor_agreements")
    .select("id")
    .eq("user_id", user.id)
    .eq("accepted", true)
    .limit(1)
    .single();

  if (!agreement) {
    return NextResponse.json(
      { error: "You must accept the Contributor Agreement before contributing.", requiresAgreement: true },
      { status: 403 },
    );
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

  // Check inactivity hold: if story was paused and new contributor joins, reactivate
  const { data: story } = await supabase
    .from("storyverse_stories")
    .select("status, story_type, inactivity_state")
    .eq("id", storyId)
    .single();

  if (story?.status === "PAUSED" && (story.story_type === "pool_open" || story.story_type === "pool_private")) {
    const { count } = await supabase
      .from("storyverse_contributors")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId);

    if (count && count > 1) {
      await supabase
        .from("storyverse_stories")
        .update({ status: "ACTIVE", inactivity_state: null, updated_at: new Date().toISOString() })
        .eq("id", storyId);
    }
  }

  // Log to ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: "contribution_submitted",
    story_id: storyId,
    round_id: roundId,
    contribution_id: contribution.id,
    user_id: user.id,
    metadata: { wordCount },
  });

  // Update inactivity timestamp
  await supabase
    .from("storyverse_stories")
    .update({
      inactivity_state: { lastActivityAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId);

  return NextResponse.json({ contribution }, { status: 201 });
}

/**
 * PUT /api/storyverse/contribute — Cast a vote on a contribution.
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

  // For paid votes, deduct credits and split revenue (platform vs author pool)
  let creditsCost = 0;
  if (voteType === "paid") {
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

    // Revenue split: platform% kept, author pool% credited to the story owner's
    // StoryVerse wallet (admin-controlled via StoryVerse Economy settings).
    try {
      const { data: pctRows } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", ["storyverse_vote_platform_percent", "storyverse_vote_author_percent"]);
      const pct = Object.fromEntries((pctRows ?? []).map((r) => [r.key, Number(r.value)]));
      const platformPct = Number.isFinite(pct.storyverse_vote_platform_percent) ? pct.storyverse_vote_platform_percent : 70;
      const authorPct = Number.isFinite(pct.storyverse_vote_author_percent) ? pct.storyverse_vote_author_percent : 30;
      const platformAmount = (creditsCost * platformPct) / 100;
      const authorAmount = (creditsCost * authorPct) / 100;

      const { data: storyOwner } = await supabase
        .from("storyverse_stories")
        .select("owner_id")
        .eq("id", storyId)
        .single();

      await supabase.from("storyverse_revenue").insert({
        story_id: storyId,
        revenue_type: "paid_vote_sale",
        gross_amount: creditsCost,
        platform_amount: platformAmount,
        author_pool_amount: authorAmount,
        distribution: storyOwner?.owner_id ? [{ userId: storyOwner.owner_id, amount: authorAmount }] : [],
        currency: "CREDITS",
      });

      if (storyOwner?.owner_id && authorAmount > 0) {
        // Credit the author pool to the story owner's wallet
        const { data: existingWallet } = await supabase
          .from("storyverse_wallets")
          .select("id, pending_balance, total_earned")
          .eq("user_id", storyOwner.owner_id)
          .single();
        if (existingWallet) {
          await supabase
            .from("storyverse_wallets")
            .update({
              pending_balance: Number(existingWallet.pending_balance ?? 0) + authorAmount,
              total_earned: Number(existingWallet.total_earned ?? 0) + authorAmount,
            })
            .eq("id", existingWallet.id);
        } else {
          await supabase.from("storyverse_wallets").insert({
            user_id: storyOwner.owner_id,
            pending_balance: authorAmount,
            available_balance: 0,
            total_earned: authorAmount,
            total_payouts: 0,
          });
        }
      }
    } catch (splitErr) {
      // Split failure must never block the vote itself
      console.warn("Paid vote revenue split failed:", splitErr instanceof Error ? splitErr.message : splitErr);
    }
  }

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

  // Check if voting period has ended — if so, finalize round and trigger AI Editor
  if (round.voting_ends_at && new Date(round.voting_ends_at) <= new Date()) {
    await finalizeRound(supabase, roundId, storyId, round);
  }

  return NextResponse.json({ ok: true, voteType, creditsCost });
}

/**
 * Finalize a round: select canon winner, trigger AI Editor, update story.
 */
async function finalizeRound(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  roundId: string,
  storyId: string,
  round: { round_number: number; chapter_id: string | null },
) {
  // Find the winning contribution (most votes)
  const { data: contributions } = await supabase
    .from("storyverse_contributions")
    .select("id, author_id, content, word_count, votes")
    .eq("round_id", roundId)
    .order("votes", { ascending: false });

  if (!contributions || contributions.length === 0) return;

  const winner = contributions[0];

  // Update round status
  await supabase
    .from("storyverse_rounds")
    .update({
      status: "COMPLETE",
      canon_contribution_id: winner.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", roundId);

  // Mark winner as canon
  await supabase
    .from("storyverse_contributions")
    .update({ is_canon: true, status: "CANON" })
    .eq("id", winner.id);

  // Mark others as rejected
  const otherIds = contributions.slice(1).map((c) => c.id);
  if (otherIds.length > 0) {
    await supabase
      .from("storyverse_contributions")
      .update({ status: "REJECTED" })
      .in("id", otherIds);
  }

  // Create or update chapter content
  if (round.chapter_id) {
    // Append canon content to chapter
    const { data: chapter } = await supabase
      .from("storyverse_chapters")
      .select("content, word_count")
      .eq("id", round.chapter_id)
      .single();

    const existingContent = chapter?.content ?? "";
    const newContent = existingContent ? `${existingContent}\n\n${winner.content}` : winner.content;
    const newWordCount = newContent.split(/\s+/).length;

    await supabase
      .from("storyverse_chapters")
      .update({ content: newContent, word_count: newWordCount, updated_at: new Date().toISOString() })
      .eq("id", round.chapter_id);
  }

  // Update story's current round
  await supabase
    .from("storyverse_stories")
    .update({ current_round: round.round_number + 1, updated_at: new Date().toISOString() })
    .eq("id", storyId);

  // Trigger AI Editor for the winning contribution
  const { data: aiEditorPriceSetting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "storyverse_ai_editor_price")
    .single();

  const aiEditorCost = Number(aiEditorPriceSetting?.value ?? 10);

  // Check if AI editor is enabled
  const { data: aiEnabledSetting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "storyverse_ai_editor_enabled")
    .single();

  const aiEnabled = aiEnabledSetting?.value === true || aiEnabledSetting?.value === "true";

  if (aiEnabled) {
    // Deduct AI Editor credits from author
    await deductCredits(winner.author_id, aiEditorCost, "ai_editor_charge", `AI Editor: Round ${round.round_number}`, winner.id, "storyverse_ai_editor");

    // Create AI Editor request
    const { data: editorRequest } = await supabase
      .from("storyverse_ai_editor_requests")
      .insert({
        story_id: storyId,
        contribution_id: winner.id,
        round_id: roundId,
        author_id: winner.author_id,
        original_content: winner.content,
        status: "processing",
        credits_cost: aiEditorCost,
      })
      .select("id")
      .single();

    // Run the review through the admin-managed AI provider chain (best-effort:
    // a failed review never blocks the round; results are persisted when ready).
    try {
      const { data: storyRow } = await supabase
        .from("storyverse_stories")
        .select("title, description")
        .eq("id", storyId)
        .single();
      const { data: priorChapters } = await supabase
        .from("storyverse_chapters")
        .select("content")
        .eq("story_id", storyId)
        .order("chapter_number", { ascending: true });

      const result = await runAiEditor({
        storyTitle: storyRow?.title ?? "Untitled",
        storyDescription: storyRow?.description ?? "",
        storySoFar: (priorChapters ?? []).map((c) => c.content).join("\n\n"),
        contribution: winner.content,
      });

      await supabase
        .from("storyverse_ai_editor_requests")
        .update({
          continuity_result: result.continuity,
          copyright_result: result.copyright,
          suggested_rewrite: result.suggestedRewrite,
          status: result.error ? "failed" : "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", editorRequest?.id);
    } catch (err) {
      await supabase
        .from("storyverse_ai_editor_requests")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", editorRequest?.id);
      console.warn("AI editor run failed:", err instanceof Error ? err.message : err);
    }
  }

  // Log canon selection
  await supabase.from("storyverse_ledger").insert({
    event_type: "round_canon_selected",
    story_id: storyId,
    round_id: roundId,
    contribution_id: winner.id,
    user_id: winner.author_id,
    metadata: {
      votes: winner.votes,
      wordCount: winner.word_count,
      aiEditorTriggered: aiEnabled,
    },
  });
}
