import type { Story, StoryLifecycleStatus, StoryType } from "@/lib/storyverse/types";
import { store, generateId } from "@/lib/storyverse/store";
import { addLedgerEntry } from "@/lib/storyverse/store";

/* ===================================================================
   LIFECYCLE STATE MACHINE

   DRAFT → ACTIVE → ROUND_VOTING → CANON_SELECTED → NEXT_ROUND
     ↓ (repeat rounds)
   STORY_COMPLETE → PUBLICATION_REVIEW → REVISION_REVIEW (if needed)
     → PUBLICATION_SNAPSHOT → PUBLISHED → MARKETPLACE → ARCHIVED
   =================================================================== */

const VALID_TRANSITIONS: Record<StoryLifecycleStatus, StoryLifecycleStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["ROUND_VOTING"],
  ROUND_VOTING: ["CANON_SELECTED"],
  CANON_SELECTED: ["NEXT_ROUND", "STORY_COMPLETE"],
  NEXT_ROUND: ["ACTIVE", "ROUND_VOTING"],
  STORY_COMPLETE: ["PUBLICATION_REVIEW"],
  PUBLICATION_REVIEW: ["PUBLISHED", "REVISION_REVIEW"],
  REVISION_REVIEW: ["PUBLICATION_REVIEW", "PUBLISHED"],
  PUBLICATION_SNAPSHOT: ["PUBLISHED"],
  PUBLISHED: ["MARKETPLACE", "ARCHIVED"],
  MARKETPLACE: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(current: StoryLifecycleStatus, target: StoryLifecycleStatus): boolean {
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

export function transitionStory(
  storyId: string,
  targetStatus: StoryLifecycleStatus,
  actorId: string,
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (!canTransition(story.status, targetStatus)) {
    return { ok: false, error: `Cannot transition from ${story.status} to ${targetStatus}` };
  }

  story.status = targetStatus;
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "story_lifecycle",
    storyId,
    userId: actorId,
    metadata: { from: story.status, to: targetStatus },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

/* ===================================================================
   STORY CREATION
   =================================================================== */

export interface CreateStoryInput {
  title: string;
  description: string;
  genre: string;
  language: string;
  storyType: StoryType;
  ownerId: string;
  ownerDisplayName: string;
  originCountry?: string;
  tags?: string[];
}

export function createStory(input: CreateStoryInput): Story {
  const storyId = generateId("story");
  const now = new Date().toISOString();

  const story: Story = {
    id: storyId,
    title: input.title,
    description: input.description,
    genre: input.genre,
    language: input.language,
    storyType: input.storyType,
    ownerId: input.ownerId,
    status: "DRAFT",
    chapters: [],
    contributors: [
      {
        userId: input.ownerId,
        displayName: input.ownerDisplayName,
        country: input.originCountry,
        role: "owner",
        joinedAt: now,
        totalContributions: 0,
        canonWins: 0,
        totalVotesReceived: 0,
        totalWordsAccepted: 0,
      },
    ],
    rounds: [],
    currentRound: 0,
    totalRounds: 0,
    coverColor: ["indigo", "teal", "amber", "rose", "violet", "sky", "emerald"][Math.floor(Math.random() * 7)],
    createdAt: now,
    updatedAt: now,
    inviteRequired: input.storyType === "pool_private",
    originCountry: input.originCountry,
    tags: input.tags ?? [],
  };

  store.stories.set(storyId, story);

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "story_lifecycle",
    storyId,
    userId: input.ownerId,
    metadata: { action: "created", storyType: input.storyType, title: input.title },
    timestamp: now,
    immutable: true,
  });

  return story;
}

export function activateStory(storyId: string, actorId: string): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.status !== "DRAFT") return { ok: false, error: "Story must be in DRAFT status" };
  if (story.storyType.startsWith("pool") && story.contributors.length < store.config.minContributorsForPool) {
    return { ok: false, error: `Pool stories need at least ${store.config.minContributorsForPool} contributors` };
  }
  return transitionStory(storyId, "ACTIVE", actorId);
}

/* ===================================================================
   ROUND MANAGEMENT
   =================================================================== */

export function startNewRound(storyId: string, chapterId: string, actorId: string): { ok: boolean; roundId?: string; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };

  const roundNum = story.currentRound + 1;
  const roundId = generateId("rnd");

  const round = {
    id: roundId,
    storyId,
    roundNumber: roundNum,
    status: "OPEN" as const,
    chapterId,
    contributionIds: [],
    createdAt: new Date().toISOString(),
  };

  story.rounds.push(round);
  story.currentRound = roundNum;
  story.totalRounds = Math.max(story.totalRounds, roundNum);
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "story_lifecycle",
    storyId,
    roundId,
    userId: actorId,
    metadata: { action: "round_started", roundNumber: roundNum },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, roundId };
}

export function beginRoundVoting(storyId: string, roundId: string, actorId: string): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };

  const round = story.rounds.find((r) => r.id === roundId);
  if (!round) return { ok: false, error: "Round not found" };
  if (round.status !== "OPEN") return { ok: false, error: "Round must be OPEN" };
  if (round.contributionIds.length === 0) return { ok: false, error: "No contributions to vote on" };

  round.status = "VOTING";
  round.votingStartedAt = new Date().toISOString();
  round.votingEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  story.status = "ROUND_VOTING";
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "story_lifecycle",
    storyId,
    roundId,
    userId: actorId,
    metadata: { action: "voting_started", roundNumber: round.roundNumber },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

/* ===================================================================
   STORY COMPLETION CHECK
   =================================================================== */

export function checkStoryComplete(storyId: string): boolean {
  const story = store.stories.get(storyId);
  if (!story) return false;
  return story.currentRound >= story.totalRounds;
}
