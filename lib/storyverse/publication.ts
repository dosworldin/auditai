import type {
  Story,
  PublicationReview,
  PublicationDecision,
  RevisionProposal,
  RevisionVote,
  PublicationSnapshot,
  ContributorShare,
} from "@/lib/storyverse/types";
import { store, generateId, addLedgerEntry } from "@/lib/storyverse/store";

/* ===================================================================
   PUBLICATION REVIEW
   =================================================================== */

export function initiatePublicationReview(storyId: string, actorId: string): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.status !== "STORY_COMPLETE") return { ok: false, error: "Story must be STORY_COMPLETE" };

  story.publicationReview = {
    storyId,
    status: "voting",
    votes: [],
    startedAt: new Date().toISOString(),
  };
  story.status = "PUBLICATION_REVIEW";
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "publication_decision",
    storyId,
    userId: actorId,
    metadata: { action: "review_initiated" },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

export function castPublicationVote(
  storyId: string,
  userId: string,
  decision: PublicationDecision,
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.status !== "PUBLICATION_REVIEW") return { ok: false, error: "Story not in publication review" };
  if (!story.publicationReview) return { ok: false, error: "No publication review active" };

  // Only contributors can vote
  const isContributor = story.contributors.some((c) => c.userId === userId);
  if (!isContributor) return { ok: false, error: "Only contributors can vote on publication" };

  // Check for duplicate vote
  const existingVote = story.publicationReview.votes.find((v) => v.userId === userId);
  if (existingVote) return { ok: false, error: "You have already voted on publication" };

  story.publicationReview.votes.push({
    userId,
    decision,
    createdAt: new Date().toISOString(),
  });

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "publication_decision",
    storyId,
    userId,
    metadata: { decision, voteCount: story.publicationReview.votes.length },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  // Check if all contributors have voted
  const totalContributors = story.contributors.length;
  const totalVotes = story.publicationReview.votes.length;

  if (totalVotes >= totalContributors) {
    // Tally votes
    const publishVotes = story.publicationReview.votes.filter((v) => v.decision === "PUBLISH_AS_IS").length;
    const revisionVotes = story.publicationReview.votes.filter((v) => v.decision === "NEEDS_REVISION").length;

    if (publishVotes > revisionVotes) {
      story.publicationReview.decision = "PUBLISH_AS_IS";
      story.publicationReview.status = "decided";
      story.publicationReview.decidedAt = new Date().toISOString();
      return { ok: true };
    } else {
      story.publicationReview.decision = "NEEDS_REVISION";
      story.publicationReview.status = "decided";
      story.publicationReview.decidedAt = new Date().toISOString();
      story.status = "REVISION_REVIEW";
      story.updatedAt = new Date().toISOString();
      return { ok: true };
    }
  }

  return { ok: true };
}

/* ===================================================================
   REVISION PROPOSALS
   =================================================================== */

export function proposeRevision(
  storyId: string,
  proposerId: string,
  chapterId: string,
  description: string,
  proposedContent?: string,
): { ok: boolean; revisionId?: string; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.status !== "REVISION_REVIEW") return { ok: false, error: "Story must be in REVISION_REVIEW" };

  const isContributor = story.contributors.some((c) => c.userId === proposerId);
  if (!isContributor) return { ok: false, error: "Only contributors can propose revisions" };

  const revisionId = generateId("rev");
  const revision: RevisionProposal = {
    id: revisionId,
    storyId,
    proposerId,
    chapterId,
    description,
    proposedContent,
    status: "proposed",
    votes: [],
    createdAt: new Date().toISOString(),
  };

  story.revisionProposal = revision;

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "revision_proposed",
    storyId,
    chapterId,
    userId: proposerId,
    metadata: { revisionId, description: description.slice(0, 200) },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, revisionId };
}

export function castRevisionVote(
  storyId: string,
  userId: string,
  decision: "accept" | "reject",
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (!story.revisionProposal) return { ok: false, error: "No revision proposal active" };
  if (story.revisionProposal.status !== "proposed") return { ok: false, error: "Revision is not open for voting" };

  const isContributor = story.contributors.some((c) => c.userId === userId);
  if (!isContributor) return { ok: false, error: "Only contributors can vote on revisions" };

  const existingVote = story.revisionProposal.votes.find((v) => v.userId === userId);
  if (existingVote) return { ok: false, error: "You have already voted on this revision" };

  story.revisionProposal.votes.push({
    userId,
    decision,
    createdAt: new Date().toISOString(),
  });

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "revision_vote",
    storyId,
    userId,
    metadata: { revisionId: story.revisionProposal.id, decision },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  // Check if all contributors voted
  const totalContributors = story.contributors.length;
  const totalVotes = story.revisionProposal.votes.length;

  if (totalVotes >= totalContributors) {
    const acceptVotes = story.revisionProposal.votes.filter((v) => v.decision === "accept").length;
    const rejectVotes = story.revisionProposal.votes.filter((v) => v.decision === "reject").length;

    if (acceptVotes > rejectVotes) {
      story.revisionProposal.status = "accepted";
      story.revisionProposal.decidedAt = new Date().toISOString();

      // Apply revision if content provided
      if (story.revisionProposal.proposedContent) {
        const chapter = story.chapters.find((ch) => ch.id === story.revisionProposal!.chapterId);
        if (chapter) {
          chapter.content = story.revisionProposal.proposedContent;
          chapter.wordCount = story.revisionProposal.proposedContent.split(/\s+/).length;
          chapter.updatedAt = new Date().toISOString();
        }
        story.revisionProposal.status = "applied";

        addLedgerEntry({
          id: generateId("ledger"),
          eventType: "revision_applied",
          storyId,
          chapterId: story.revisionProposal.chapterId,
          metadata: { revisionId: story.revisionProposal.id },
          timestamp: new Date().toISOString(),
          immutable: true,
        });
      }

      // Return to publication review for re-vote
      story.status = "PUBLICATION_REVIEW";
      story.publicationReview = {
        storyId,
        status: "voting",
        votes: [],
        startedAt: new Date().toISOString(),
      };
    } else {
      story.revisionProposal.status = "rejected";
      story.revisionProposal.decidedAt = new Date().toISOString();

      // Return to publication review
      story.status = "PUBLICATION_REVIEW";
      story.publicationReview = {
        storyId,
        status: "voting",
        votes: [],
        startedAt: new Date().toISOString(),
      };
    }
    story.updatedAt = new Date().toISOString();
  }

  return { ok: true };
}

/* ===================================================================
   PUBLICATION SNAPSHOT (IMMUTABLE)
   =================================================================== */

export function createPublicationSnapshot(storyId: string, actorId: string): { ok: boolean; snapshot?: PublicationSnapshot; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.status !== "PUBLICATION_REVIEW") return { ok: false, error: "Story must be in PUBLICATION_REVIEW with PUBLISH_AS_IS decision" };
  if (story.publicationReview?.decision !== "PUBLISH_AS_IS") {
    return { ok: false, error: "Publication decision must be PUBLISH_AS_IS" };
  }

  // Calculate contribution scores for snapshot
  const contributorShares = calculateContributorShares(story);

  // Build content hash
  const contentStr = story.chapters.map((ch) => ch.content).join("\n");
  const contentHash = `sha256:${simpleHash(contentStr)}`;

  const snapshot: PublicationSnapshot = {
    storyId,
    publishedAt: new Date().toISOString(),
    contributorShares,
    totalAcceptedWords: story.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
    platformRevenuePercent: store.config.bookSalePlatformPercent,
    authorPoolRevenuePercent: store.config.bookSaleAuthorPoolPercent,
    contentHash,
    chapterCount: story.chapters.length,
    totalRounds: story.currentRound,
    immutable: true,
  };

  story.publicationSnapshot = snapshot;
  story.status = "PUBLICATION_SNAPSHOT";
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "publication_decision",
    storyId,
    userId: actorId,
    metadata: {
      action: "snapshot_created",
      totalWords: snapshot.totalAcceptedWords,
      contributorCount: contributorShares.length,
      contentHash: snapshot.contentHash,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, snapshot };
}

function calculateContributorShares(story: Story): ContributorShare[] {
  const { scoringWeights } = store.config;
  const totalWeight = scoringWeights.canonWinsPercent + scoringWeights.publishedWordsPercent +
    scoringWeights.voteScorePercent + scoringWeights.participationPercent;

  // Calculate raw scores per contributor
  const scores = story.contributors.map((c) => {
    const canonWinScore = c.canonWins * 10;
    const publishedWordScore = Math.min(100, (c.totalWordsAccepted / Math.max(1, story.chapters.reduce((s, ch) => s + ch.wordCount, 0))) * 100);
    const voteScore = Math.min(100, c.totalVotesReceived / Math.max(1, story.contributors.length));
    const participationScore = Math.min(100, c.totalContributions * 10);

    const totalScore = (
      canonWinScore * (scoringWeights.canonWinsPercent / totalWeight) +
      publishedWordScore * (scoringWeights.publishedWordsPercent / totalWeight) +
      voteScore * (scoringWeights.voteScorePercent / totalWeight) +
      participationScore * (scoringWeights.participationPercent / totalWeight)
    );

    return {
      userId: c.userId,
      displayName: c.displayName,
      country: c.country,
      contributionScore: totalScore,
      canonWins: c.canonWins,
      wordsAccepted: c.totalWordsAccepted,
      totalVotesReceived: c.totalVotesReceived,
      contributionsCount: c.totalContributions,
      totalScore,
    };
  });

  // Normalize to percentages
  const grandTotal = scores.reduce((sum, s) => sum + s.totalScore, 0) || 1;

  return scores.map((s) => ({
    userId: s.userId,
    displayName: s.displayName,
    country: s.country,
    sharePercent: Math.round((s.totalScore / grandTotal) * 1000) / 10,
    contributionScore: s.contributionScore,
    canonWins: s.canonWins,
    wordsAccepted: s.wordsAccepted,
    totalVotesReceived: s.totalVotesReceived,
    contributionsCount: s.contributionsCount,
  }));
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
