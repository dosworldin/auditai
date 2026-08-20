import type {
  Contribution,
  ContributionStatus,
  Vote,
  VoteType,
  Story,
  StoryRound,
} from "@/lib/storyverse/types";
import {
  store,
  generateId,
  addContribution,
  addVote,
  getVotesByRound,
  getVotesByContribution,
  addLedgerEntry,
} from "@/lib/storyverse/store";

/* ===================================================================
   CONTRIBUTION SUBMISSION
   =================================================================== */

export interface SubmitContributionInput {
  storyId: string;
  roundId: string;
  authorId: string;
  authorDisplayName: string;
  authorCountry?: string;
  content: string;
}

export function submitContribution(input: SubmitContributionInput): { ok: boolean; contribution?: Contribution; error?: string } {
  const story = store.stories.get(input.storyId);
  if (!story) return { ok: false, error: "Story not found" };

  // Status check
  const validStatuses: Story["status"][] = ["ACTIVE", "ROUND_VOTING"];
  if (!validStatuses.includes(story.status)) {
    return { ok: false, error: "Story is not accepting contributions" };
  }

  // Solo stories: only owner can contribute
  if (story.storyType.startsWith("solo") && story.ownerId !== input.authorId) {
    return { ok: false, error: "Solo stories only accept contributions from the owner" };
  }

  // Round check
  const round = story.rounds.find((r) => r.id === input.roundId);
  if (!round) return { ok: false, error: "Round not found" };
  if (round.status !== "OPEN" && round.status !== "VOTING") {
    return { ok: false, error: "Round is not accepting contributions" };
  }

  // Anti-abuse: suspended user check
  const isSuspended = store.abuseFlags.some(
    (f) => f.userId === input.authorId && !f.resolved && (f.flagType === "sybil_suspect" || f.flagType === "vote_manipulation"),
  );
  if (isSuspended) {
    return { ok: false, error: "This account is suspended from contributing" };
  }

  // Word count limits
  const wordCount = input.content.trim().split(/\s+/).length;
  if (wordCount < store.config.minWordsPerContribution) {
    return { ok: false, error: `Minimum ${store.config.minWordsPerContribution} words required` };
  }
  if (wordCount > store.config.maxWordsPerContribution) {
    return { ok: false, error: `Maximum ${store.config.maxWordsPerContribution} words allowed` };
  }

  // Max contributors per round
  const existingContribs = round.contributionIds.length;
  if (existingContribs >= store.config.maxContributorsPerRound) {
    return { ok: false, error: "This round has reached the maximum number of contributions" };
  }

  // Create contribution
  const contribution: Contribution = {
    id: generateId("contrib"),
    storyId: input.storyId,
    roundId: input.roundId,
    authorId: input.authorId,
    authorDisplayName: input.authorDisplayName,
    authorCountry: input.authorCountry,
    content: input.content,
    wordCount,
    status: "PENDING",
    votes: 0,
    isCanon: false,
    aiPolishStatus: "none",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addContribution(contribution);
  round.contributionIds.push(contribution.id);

  // Update contributor stats
  const contributor = story.contributors.find((c) => c.userId === input.authorId);
  if (contributor) {
    contributor.totalContributions++;
  }

  // Ledger
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "contribution",
    storyId: input.storyId,
    roundId: input.roundId,
    contributionId: contribution.id,
    userId: input.authorId,
    metadata: {
      wordCount,
      authorDisplayName: input.authorDisplayName,
      authorCountry: input.authorCountry,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, contribution };
}

/* ===================================================================
   VOTING
   =================================================================== */

export interface CastVoteInput {
  contributionId: string;
  voterId: string;
  voteType: VoteType;
  tokenAmount?: number;
}

export function castVote(input: CastVoteInput): { ok: boolean; vote?: Vote; error?: string } {
  const contribution = store.contributions.get(input.contributionId);
  if (!contribution) return { ok: false, error: "Contribution not found" };

  const story = store.stories.get(contribution.storyId);
  if (!story) return { ok: false, error: "Story not found" };

  // Cannot vote on own contribution
  if (contribution.authorId === input.voterId) {
    return { ok: false, error: "You cannot vote for your own contribution" };
  }

  // Anti-abuse: suspended user check
  const isSuspended = store.abuseFlags.some(
    (f) => f.userId === input.voterId && !f.resolved && (f.flagType === "sybil_suspect" || f.flagType === "vote_manipulation"),
  );
  if (isSuspended) {
    return { ok: false, error: "This account is suspended from voting" };
  }

  // Duplicate vote check
  const existingVotes = getVotesByContribution(input.contributionId);
  const duplicateVote = existingVotes.find((v) => v.voterId === input.voterId);
  if (duplicateVote) {
    // Log abuse attempt
    store.abuseFlags.push({
      id: generateId("abuse"),
      userId: input.voterId,
      storyId: contribution.storyId,
      flagType: "duplicate_vote",
      details: `User ${input.voterId} attempted duplicate vote on contribution ${input.contributionId}`,
      detectedAt: new Date().toISOString(),
      resolved: false,
    });
    return { ok: false, error: "You have already voted for this contribution" };
  }

  // Self-voting check (shouldn't happen due to earlier check, but defense-in-depth)
  if (contribution.authorId === input.voterId) {
    store.abuseFlags.push({
      id: generateId("abuse"),
      userId: input.voterId,
      storyId: contribution.storyId,
      flagType: "self_vote",
      details: `Self-vote attempt by ${input.voterId} on their own contribution ${input.contributionId}`,
      detectedAt: new Date().toISOString(),
      resolved: false,
    });
    return { ok: false, error: "Self-voting is not allowed" };
  }

  // Per-user vote limit per round
  const roundVotes = getVotesByRound(contribution.roundId).filter((v) => v.voterId === input.voterId);
  if (roundVotes.length >= store.config.maxVotesPerUserPerRound) {
    return { ok: false, error: `Maximum ${store.config.maxVotesPerUserPerRound} votes per round` };
  }

  // Paid vote: check token balance
  let weight = 1;
  if (input.voteType === "paid") {
    if (!input.tokenAmount || input.tokenAmount <= 0) {
      return { ok: false, error: "Token amount required for paid votes" };
    }
    const balance = store.tokenBalances.get(input.voterId);
    if (!balance || balance.balance < input.tokenAmount) {
      return { ok: false, error: "Insufficient voting tokens" };
    }
    // Deduct tokens
    balance.balance -= input.tokenAmount;
    balance.totalUsed += input.tokenAmount;

    // Paid voting revenue: 70% platform, 30% author pool
    const grossRevenue = input.tokenAmount * store.config.paidVotePrice;
    const platformAmount = grossRevenue * (store.config.paidVotePlatformPercent / 100);
    const authorPoolAmount = grossRevenue * (store.config.paidVoteAuthorPoolPercent / 100);

    addLedgerEntry({
      id: generateId("ledger"),
      eventType: "paid_vote_sale",
      storyId: contribution.storyId,
      roundId: contribution.roundId,
      contributionId: input.contributionId,
      userId: input.voterId,
      metadata: {
        tokensUsed: input.tokenAmount,
        grossRevenue,
        platformAmount,
        authorPoolAmount,
        split: `${store.config.paidVotePlatformPercent}/${store.config.paidVoteAuthorPoolPercent}`,
      },
      timestamp: new Date().toISOString(),
      immutable: true,
    });

    // Token transaction
    store.tokenTransactions.push({
      id: generateId("token-tx"),
      userId: input.voterId,
      type: "vote_cast",
      amount: -input.tokenAmount,
      balanceAfter: balance.balance,
      description: `Paid vote on contribution`,
      voteId: undefined, // will be set after vote creation
      createdAt: new Date().toISOString(),
    });

    weight = input.tokenAmount; // Paid votes have weight equal to tokens
  }

  // Create vote
  const vote: Vote = {
    id: generateId("vote"),
    contributionId: input.contributionId,
    storyId: contribution.storyId,
    roundId: contribution.roundId,
    voterId: input.voterId,
    voteType: input.voteType,
    weight,
    tokenAmount: input.voteType === "paid" ? input.tokenAmount : undefined,
    createdAt: new Date().toISOString(),
  };

  addVote(vote);
  contribution.votes += weight;
  contribution.updatedAt = new Date().toISOString();

  // Ledger entry for vote
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "vote",
    storyId: contribution.storyId,
    roundId: contribution.roundId,
    contributionId: input.contributionId,
    userId: input.voterId,
    metadata: {
      voteType: input.voteType,
      weight,
      totalVotesAfter: contribution.votes,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, vote };
}

/* ===================================================================
   CANON SELECTION
   =================================================================== */

export function selectCanon(storyId: string, roundId: string): { ok: boolean; canonContributionId?: string; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };

  const round = story.rounds.find((r) => r.id === roundId);
  if (!round) return { ok: false, error: "Round not found" };
  if (round.status !== "VOTING") return { ok: false, error: "Round must be in VOTING status" };

  // Get all contributions for this round, sorted by votes
  const contributions = round.contributionIds
    .map((id) => store.contributions.get(id))
    .filter((c): c is Contribution => c !== undefined)
    .sort((a, b) => b.votes - a.votes);

  if (contributions.length === 0) return { ok: false, error: "No contributions found" };

  const winner = contributions[0];
  if (winner.votes === 0) {
    return { ok: false, error: "Cannot select canon with zero votes" };
  }

  // Mark winner as canon
  winner.status = "CANON";
  winner.isCanon = true;
  winner.updatedAt = new Date().toISOString();

  // Mark others as rejected
  for (let i = 1; i < contributions.length; i++) {
    contributions[i].status = "REJECTED";
    contributions[i].updatedAt = new Date().toISOString();
  }

  // Update round
  round.status = "CANON_SELECTED";
  round.canonContributionId = winner.id;
  round.completedAt = new Date().toISOString();

  // Update contributor stats
  const winnerContributor = story.contributors.find((c) => c.userId === winner.authorId);
  if (winnerContributor) {
    winnerContributor.canonWins++;
    winnerContributor.totalVotesReceived += winner.votes;
    winnerContributor.totalWordsAccepted += winner.wordCount;
  }

  // Add canon result
  store.canonResults.set(roundId, {
    roundId,
    canonContributionId: winner.id,
    totalVotes: contributions.reduce((sum, c) => sum + c.votes, 0),
    winnerVotes: winner.votes,
    runnerUpId: contributions.length > 1 ? contributions[1].id : undefined,
    runnerUpVotes: contributions.length > 1 ? contributions[1].votes : undefined,
    selectedAt: new Date().toISOString(),
  });

  // Assemble canon content into chapter
  const chapter = story.chapters.find((ch) => ch.id === round.chapterId);
  if (chapter) {
    chapter.content += "\n\n" + winner.content;
    chapter.canonContributionIds.push(winner.id);
    chapter.wordCount += winner.wordCount;
    chapter.updatedAt = new Date().toISOString();
  }

  // Transition story
  story.status = "CANON_SELECTED";
  story.updatedAt = new Date().toISOString();

  // Ledger
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "canon_win",
    storyId,
    roundId,
    contributionId: winner.id,
    userId: winner.authorId,
    metadata: {
      roundNumber: round.roundNumber,
      winnerVotes: winner.votes,
      totalVotes: contributions.reduce((sum, c) => sum + c.votes, 0),
      wordCount: winner.wordCount,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "published_words",
    storyId,
    roundId,
    contributionId: winner.id,
    userId: winner.authorId,
    metadata: { wordCount: winner.wordCount, chapterId: round.chapterId },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, canonContributionId: winner.id };
}
