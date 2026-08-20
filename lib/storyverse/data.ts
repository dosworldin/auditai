import type { StorySnippet, StoryWork } from "@/lib/types";
import { getAllStories } from "@/lib/storyverse/engine";

/** Generate StoryWork[] from the engine store for backward-compatible UI. */
export function getStoryWorks(): StoryWork[] {
  return getAllStories().map((s) => ({
    id: s.id,
    title: s.title,
    synopsis: s.description,
    genre: s.genre,
    author: s.contributors.find((c) => c.role === "owner")?.displayName ?? "Unknown",
    contributors: s.contributors.length,
    rounds: s.currentRound,
    status: s.status === "PUBLISHED" || s.status === "MARKETPLACE" ? "Published"
      : s.status === "PUBLICATION_REVIEW" || s.status === "REVISION_REVIEW" ? "In Review"
      : s.status === "DRAFT" ? "Draft"
      : "In Progress",
    coverColor: s.coverColor,
    chapters: s.chapters.length,
    progress: s.totalRounds > 0 ? Math.round((s.currentRound / s.totalRounds) * 100) : 0,
  }));
}

/** Backward-compatible constant (calls getStoryWorks under the hood). */
export const STORY_WORKS: StoryWork[] = getStoryWorks();

export const SNIPPETS: StorySnippet[] = [
  {
    id: "snip-1",
    author: "Maya R.",
    text: "The storm bell rang twice, then fell silent - just as it had in the journal's final page.",
    votes: 47,
    aiStatus: "Passed",
  },
  {
    id: "snip-2",
    author: "Kiran V.",
    text: "He traced the ink with a trembling finger. The date was tomorrow.",
    votes: 63,
    aiStatus: "Passed",
  },
  {
    id: "snip-3",
    author: "Priya L.",
    text: "But the keeper had already bolted the door, for the keeper was the storm.",
    votes: 81,
    aiStatus: "Pending",
  },
  {
    id: "snip-4",
    author: "Anon",
    text: "Wait, wasn't the journal supposed to be lost at sea?",
    votes: 12,
    aiStatus: "Flagged",
  },
];

export const DISCUSSION_THREADS = [
  {
    id: "thread-1",
    title: "Should Chapter 3 reveal the journal's origin?",
    author: "Maya R.",
    replies: 24,
    lastActivity: "2 hours ago",
    pinned: true,
  },
  {
    id: "thread-2",
    title: "Vote on the next canon twist for Round 8",
    author: "Kiran V.",
    replies: 41,
    lastActivity: "30 minutes ago",
    pinned: false,
  },
  {
    id: "thread-3",
    title: "Style guide: how we handle tense shifts",
    author: "Priya L.",
    replies: 17,
    lastActivity: "Yesterday",
    pinned: false,
  },
];

export const WALLET_ENTRIES = [
  {
    id: "tx-1",
    description: "Publication revenue - Midnight at Cafe Luna",
    amount: "+ $128.40",
    date: "Aug 9, 2026",
    kind: "earnings",
  },
  {
    id: "tx-2",
    description: "Canon contribution bonus - Round 12",
    amount: "+ $6.00",
    date: "Aug 7, 2026",
    kind: "earnings",
  },
  {
    id: "tx-3",
    description: "Premium chapter purchase",
    amount: "- $1.99",
    date: "Aug 5, 2026",
    kind: "spend",
  },
  {
    id: "tx-4",
    description: "Withdrawal to bank (pending)",
    amount: "- $50.00",
    date: "Aug 3, 2026",
    kind: "withdrawal",
  },
];
