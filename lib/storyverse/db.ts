/**
 * Supabase repository for StoryVerse.
 * Replaces the in-memory Map-based store with real DB queries.
 * All functions maintain the same signatures used by the StoryVerse engine modules.
 */

import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import type {
  Story,
  StoryLifecycleStatus,
  Contribution,
  Vote,
  LedgerEntry,
  RevenueEntry,
  LibraryEntry,
  AuthorWallet,
  PayoutRequest,
  VotingTokenBalance,
  AiEditorRequest,
  CopyrightAnalysis,
  ContributorAgreement,
  SoloInvitationPayment,
  StoryInvitation,
} from "@/lib/storyverse/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function adminClient() {
  return getSupabaseAdmin();
}

/* ------------------------------------------------------------------ */
/*  Stories                                                            */
/* ------------------------------------------------------------------ */

export async function getStoryFromDB(id: string): Promise<Story | undefined> {
  const supabase = await adminClient();
  const { data: story, error } = await supabase
    .from("storyverse_stories")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !story) return undefined;
  return mapStoryFromRow(story);
}

export async function getAllStoriesFromDB(): Promise<Story[]> {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("storyverse_stories")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapStoryFromRow);
}

export async function getStoriesByStatusFromDB(
  status: StoryLifecycleStatus,
): Promise<Story[]> {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("storyverse_stories")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapStoryFromRow);
}

export async function getStoriesByOwnerFromDB(ownerId: string): Promise<Story[]> {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("storyverse_stories")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapStoryFromRow);
}

export async function addStoryToDB(
  story: Story,
  contributors: { userId: string; displayName: string; country?: string; role: string }[],
): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_stories").insert({
    id: story.id,
    title: story.title,
    description: story.description,
    genre: story.genre,
    language: story.language,
    story_type: story.storyType,
    owner_id: story.ownerId,
    status: story.status,
    current_round: story.currentRound,
    total_rounds: story.totalRounds,
    cover_color: story.coverColor,
    invite_required: story.inviteRequired,
    origin_country: story.originCountry,
    tags: story.tags,
    inactivity_state: story.inactivityState ?? null,
    contributor_agreement_version: story.contributorAgreementVersion ?? null,
    created_at: story.createdAt,
    updated_at: story.updatedAt,
  });

  // Insert contributors
  if (contributors.length > 0) {
    await supabase.from("storyverse_contributors").insert(
      contributors.map((c) => ({
        story_id: story.id,
        user_id: c.userId,
        display_name: c.displayName,
        country: c.country ?? null,
        role: c.role,
      })),
    );
  }
}

export async function updateStoryInDB(
  id: string,
  updates: Partial<{
    status: StoryLifecycleStatus;
    current_round: number;
    total_rounds: number;
    inactivity_state: unknown;
  }>,
): Promise<void> {
  const supabase = await adminClient();
  await supabase
    .from("storyverse_stories")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  Contributors                                                       */
/* ------------------------------------------------------------------ */

export async function getContributorsFromDB(storyId: string) {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_contributors")
    .select("*")
    .eq("story_id", storyId);
  return data ?? [];
}

export async function addContributorToDB(
  storyId: string,
  userId: string,
  displayName: string,
  country: string | null,
  role: string,
) {
  const supabase = await adminClient();
  await supabase.from("storyverse_contributors").insert({
    story_id: storyId,
    user_id: userId,
    display_name: displayName,
    country,
    role,
  });
}

/* ------------------------------------------------------------------ */
/*  Contributions                                                      */
/* ------------------------------------------------------------------ */

export async function getContributionsByRoundFromDB(roundId: string): Promise<Contribution[]> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_contributions")
    .select("*")
    .eq("round_id", roundId);
  if (!data) return [];
  return data.map(mapContributionFromRow);
}

export async function addContributionToDB(c: Contribution): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_contributions").insert({
    id: c.id,
    story_id: c.storyId,
    round_id: c.roundId,
    author_id: c.authorId,
    author_display_name: c.authorDisplayName,
    author_country: c.authorCountry ?? null,
    content: c.content,
    word_count: c.wordCount,
    status: c.status,
    votes: c.votes,
    is_canon: c.isCanon,
    ai_polish_status: c.aiPolishStatus,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  });
}

/* ------------------------------------------------------------------ */
/*  Votes                                                              */
/* ------------------------------------------------------------------ */

export async function getVotesByContributionFromDB(
  contributionId: string,
): Promise<Vote[]> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_votes")
    .select("*")
    .eq("contribution_id", contributionId);
  if (!data) return [];
  return data.map(mapVoteFromRow);
}

export async function getVotesByRoundFromDB(roundId: string): Promise<Vote[]> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_votes")
    .select("*")
    .eq("round_id", roundId);
  if (!data) return [];
  return data.map(mapVoteFromRow);
}

export async function addVoteToDB(v: Vote): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_votes").insert({
    id: v.id,
    contribution_id: v.contributionId,
    story_id: v.storyId,
    round_id: v.roundId,
    voter_id: v.voterId,
    vote_type: v.voteType,
    weight: v.weight,
    token_amount: v.tokenAmount ?? null,
    created_at: v.createdAt,
  });
}

/* ------------------------------------------------------------------ */
/*  Ledger                                                             */
/* ------------------------------------------------------------------ */

export async function addLedgerEntryToDB(entry: LedgerEntry): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_ledger").insert({
    id: entry.id,
    event_type: entry.eventType,
    story_id: entry.storyId ?? null,
    round_id: entry.roundId ?? null,
    chapter_id: entry.chapterId ?? null,
    contribution_id: entry.contributionId ?? null,
    user_id: entry.userId ?? null,
    metadata: entry.metadata ?? {},
    timestamp: entry.timestamp,
  });
}

export async function getLedgerByStoryFromDB(storyId: string): Promise<LedgerEntry[]> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_ledger")
    .select("*")
    .eq("story_id", storyId)
    .order("timestamp", { ascending: true });
  if (!data) return [];
  return data.map(mapLedgerFromRow);
}

/* ------------------------------------------------------------------ */
/*  Revenue                                                            */
/* ------------------------------------------------------------------ */

export async function addRevenueEntryToDB(entry: RevenueEntry): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_revenue").insert({
    id: entry.id,
    story_id: entry.storyId,
    revenue_type: entry.revenueType,
    gross_amount: entry.grossAmount,
    platform_amount: entry.platformAmount,
    author_pool_amount: entry.authorPoolAmount,
    distribution: entry.distribution ?? [],
    currency: entry.currency,
    created_at: entry.createdAt,
  });
}

/* ------------------------------------------------------------------ */
/*  Wallets                                                            */
/* ------------------------------------------------------------------ */

export async function getWalletFromDB(userId: string): Promise<AuthorWallet> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_wallets")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!data) {
    // Create default wallet
    const defaultWallet: AuthorWallet = {
      userId,
      totalEarned: 0,
      pendingBalance: 0,
      availableBalance: 0,
      totalPayouts: 0,
      storyEarnings: [],
      transactions: [],
    };
    await supabase.from("storyverse_wallets").insert({
      user_id: userId,
      total_earned: 0,
      pending_balance: 0,
      available_balance: 0,
      total_payouts: 0,
    });
    return defaultWallet;
  }
  return {
    userId,
    totalEarned: data.total_earned ?? 0,
    pendingBalance: data.pending_balance ?? 0,
    availableBalance: data.available_balance ?? 0,
    totalPayouts: data.total_payouts ?? 0,
    storyEarnings: [],
    transactions: [],
  };
}

export async function updateWalletInDB(
  userId: string,
  updates: Partial<{
    total_earned: number;
    pending_balance: number;
    available_balance: number;
    total_payouts: number;
  }>,
): Promise<void> {
  const supabase = await adminClient();
  const existing = await supabase
    .from("storyverse_wallets")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  if (!existing.data) {
    await supabase.from("storyverse_wallets").insert({ user_id: userId, ...updates });
  } else {
    await supabase
      .from("storyverse_wallets")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
}

/* ------------------------------------------------------------------ */
/*  Library                                                            */
/* ------------------------------------------------------------------ */

export async function getLibraryForUserFromDB(userId: string): Promise<LibraryEntry[]> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_library")
    .select("*")
    .eq("user_id", userId);
  if (!data) return [];
  return data.map((r) => ({
    userId: r.user_id,
    storyId: r.story_id,
    accessType: r.access_type,
    addedAt: r.added_at,
  }));
}

export async function hasLibraryAccessFromDB(
  userId: string,
  storyId: string,
): Promise<boolean> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_library")
    .select("id")
    .eq("user_id", userId)
    .eq("story_id", storyId)
    .limit(1)
    .single();
  return !!data;
}

export async function addLibraryEntryToDB(entry: LibraryEntry): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_library").insert({
    user_id: entry.userId,
    story_id: entry.storyId,
    access_type: entry.accessType,
  });
}

/* ------------------------------------------------------------------ */
/*  Token Balances                                                     */
/* ------------------------------------------------------------------ */

export async function getTokenBalanceFromDB(
  userId: string,
): Promise<VotingTokenBalance> {
  // Token balance is tracked via profile credits for simplicity
  const supabase = await adminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  return {
    userId,
    balance: (profile?.credits as number) ?? 0,
    totalPurchased: 0,
    totalUsed: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Invitations                                                        */
/* ------------------------------------------------------------------ */

export async function getInvitationsForStoryFromDB(
  storyId: string,
): Promise<StoryInvitation[]> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_invitations")
    .select("*")
    .eq("story_id", storyId);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    storyId: r.story_id,
    inviterId: r.inviter_id,
    inviteeId: r.invitee_id,
    status: r.status as StoryInvitation["status"],
    expiresAt: r.expires_at,
    invitePrice: r.invite_price ?? 0,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at ?? null,
  }));
}

export async function addInvitationToDB(invitation: StoryInvitation): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_invitations").insert({
    id: invitation.id,
    story_id: invitation.storyId,
    inviter_id: invitation.inviterId,
    invitee_id: invitation.inviteeId,
    status: invitation.status,
    expires_at: invitation.expiresAt,
    invite_price: invitation.invitePrice,
    accepted_at: invitation.acceptedAt ?? null,
  });
}

/* ------------------------------------------------------------------ */
/*  Contributor Agreements                                             */
/* ------------------------------------------------------------------ */

export async function getContributorAgreementFromDB(
  userId: string,
): Promise<ContributorAgreement | undefined> {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_contributor_agreements")
    .select("*")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .single();
  if (!data) return undefined;
  return {
    id: data.id,
    userId: data.user_id,
    agreementVersion: data.agreement_version,
    agreementTextHash: data.agreement_text_hash,
    accepted: data.accepted,
    acceptedAt: data.accepted_at,
  };
}

export async function addContributorAgreementToDB(
  agreement: ContributorAgreement,
): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_contributor_agreements").insert({
    id: agreement.id,
    user_id: agreement.userId,
    agreement_version: agreement.agreementVersion,
    agreement_text_hash: agreement.agreementTextHash,
    accepted: agreement.accepted,
    accepted_at: agreement.acceptedAt,
  });
}

/* ------------------------------------------------------------------ */
/*  AI Editor Requests                                                 */
/* ------------------------------------------------------------------ */

export async function addAiEditorRequestToDB(req: AiEditorRequest): Promise<void> {
  const supabase = await adminClient();
  await supabase.from("storyverse_ai_editor_requests").insert({
    id: req.id,
    story_id: req.storyId,
    contribution_id: req.contributionId,
    round_id: req.roundId ?? null,
    author_id: req.authorId,
    original_content: req.originalContent,
    continuity_result: req.continuityResult ?? null,
    copyright_result: req.copyrightResult ?? null,
    suggested_rewrite: req.suggestedRewrite ?? null,
    approved_content: req.approvedContent ?? null,
    status: req.status,
    credits_cost: req.creditsCost,
    created_at: req.createdAt,
    completed_at: req.completedAt ?? null,
  });
}

/* ------------------------------------------------------------------ */
/*  Copyright Analyses                                                 */
/* ------------------------------------------------------------------ */

export async function addCopyrightAnalysisToDB(
  analysis: CopyrightAnalysis,
): Promise<void> {
  // Stored as part of AI editor request, no separate table needed
}

/* ------------------------------------------------------------------ */
/*  Solo Invitation Payments                                           */
/* ------------------------------------------------------------------ */

export async function addSoloInvitationPaymentToDB(
  payment: SoloInvitationPayment,
): Promise<void> {
  // Tracked via credit_ledger
}

/* ------------------------------------------------------------------ */
/*  Rounds                                                             */
/* ------------------------------------------------------------------ */

export async function getRoundsFromDB(storyId: string) {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_rounds")
    .select("*")
    .eq("story_id", storyId)
    .order("round_number", { ascending: true });
  return data ?? [];
}

export async function addRoundToDB(round: {
  id: string;
  story_id: string;
  round_number: number;
  status: string;
  chapter_id?: string;
  voting_started_at?: string;
  voting_ends_at?: string;
}) {
  const supabase = await adminClient();
  await supabase.from("storyverse_rounds").insert({
    id: round.id,
    story_id: round.story_id,
    round_number: round.round_number,
    status: round.status,
    chapter_id: round.chapter_id ?? null,
    voting_started_at: round.voting_started_at ?? null,
    voting_ends_at: round.voting_ends_at ?? null,
  });
}

export async function updateRoundInDB(
  id: string,
  updates: Partial<{
    status: string;
    canon_contribution_id: string;
    completed_at: string;
  }>,
) {
  const supabase = await adminClient();
  await supabase
    .from("storyverse_rounds")
    .update(updates)
    .eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  Chapters                                                           */
/* ------------------------------------------------------------------ */

export async function getChaptersFromDB(storyId: string) {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("storyverse_chapters")
    .select("*")
    .eq("story_id", storyId)
    .order("number", { ascending: true });
  return data ?? [];
}

export async function addChapterToDB(chapter: {
  id: string;
  story_id: string;
  number: number;
  title: string;
  content: string;
  word_count: number;
}) {
  const supabase = await adminClient();
  await supabase.from("storyverse_chapters").insert(chapter);
}

/* ------------------------------------------------------------------ */
/*  Row Mappers                                                        */
/* ------------------------------------------------------------------ */

function mapStoryFromRow(row: Record<string, unknown>): Story {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    genre: row.genre as string,
    language: (row.language as string) ?? "English",
    storyType: row.story_type as Story["storyType"],
    ownerId: row.owner_id as string,
    status: row.status as StoryLifecycleStatus,
    chapters: [],
    contributors: [],
    rounds: [],
    currentRound: (row.current_round as number) ?? 0,
    totalRounds: (row.total_rounds as number) ?? 0,
    coverColor: (row.cover_color as string) ?? "indigo",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    inviteRequired: (row.invite_required as boolean) ?? false,
    originCountry: (row.origin_country as string) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    inactivityState: (row.inactivity_state as Story["inactivityState"]) ?? undefined,
    contributorAgreementVersion: (row.contributor_agreement_version as string) ?? undefined,
  };
}

function mapContributionFromRow(row: Record<string, unknown>): Contribution {
  return {
    id: row.id as string,
    storyId: row.story_id as string,
    roundId: row.round_id as string,
    authorId: row.author_id as string,
    authorDisplayName: row.author_display_name as string,
    authorCountry: (row.author_country as string) ?? undefined,
    content: row.content as string,
    wordCount: (row.word_count as number) ?? 0,
    status: row.status as Contribution["status"],
    votes: (row.votes as number) ?? 0,
    isCanon: (row.is_canon as boolean) ?? false,
    aiPolishStatus: ((row.ai_polish_status as string) ?? "none") as Contribution["aiPolishStatus"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapVoteFromRow(row: Record<string, unknown>): Vote {
  return {
    id: row.id as string,
    contributionId: row.contribution_id as string,
    storyId: row.story_id as string,
    roundId: row.round_id as string,
    voterId: row.voter_id as string,
    voteType: row.vote_type as Vote["voteType"],
    weight: (row.weight as number) ?? 1,
    tokenAmount: (row.token_amount as number) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function mapLedgerFromRow(row: Record<string, unknown>): LedgerEntry {
  return {
    id: row.id as string,
    eventType: row.event_type as LedgerEntry["eventType"],
    storyId: (row.story_id as string) ?? undefined,
    roundId: (row.round_id as string) ?? undefined,
    chapterId: (row.chapter_id as string) ?? undefined,
    contributionId: (row.contribution_id as string) ?? undefined,
    userId: (row.user_id as string) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    timestamp: row.timestamp as string,
    immutable: true,
  };
}
