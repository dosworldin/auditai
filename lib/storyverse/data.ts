import type { StorySnippet, StoryWork } from "@/lib/types";

export const STORY_WORKS: StoryWork[] = [
  {
    id: "the-lighthouse-keeper",
    title: "The Lighthouse Keeper",
    synopsis:
      "A reclusive lighthouse keeper discovers a journal that predicts every storm before it arrives.",
    genre: "Mystery",
    author: "Maya R.",
    contributors: 42,
    rounds: 7,
    status: "In Progress",
    coverColor: "indigo",
    chapters: 4,
    progress: 58,
  },
  {
    id: "city-of-broken-clocks",
    title: "City of Broken Clocks",
    synopsis:
      "In a city where time stopped at midnight, one young courier races to restart it.",
    genre: "Sci-Fi",
    author: "Dev K.",
    contributors: 87,
    rounds: 12,
    status: "In Review",
    coverColor: "teal",
    chapters: 9,
    progress: 100,
  },
  {
    id: "the-orchard-of-echoes",
    title: "The Orchard of Echoes",
    synopsis:
      "Three sisters inherit an orchard where every fruit tastes like a memory.",
    genre: "Fantasy",
    author: "Anaya S.",
    contributors: 23,
    rounds: 5,
    status: "Draft",
    coverColor: "amber",
    chapters: 2,
    progress: 15,
  },
  {
    id: "midnight-at-cafe-luna",
    title: "Midnight at Cafe Luna",
    synopsis:
      "Regulars at a late-night cafe realize their orders always predict their futures.",
    genre: "Slice of Life",
    author: "Rohan T.",
    contributors: 58,
    rounds: 9,
    status: "Published",
    coverColor: "rose",
    chapters: 12,
    progress: 100,
  },
  {
    id: "the-cartographer-s-daughter",
    title: "The Cartographer's Daughter",
    synopsis:
      "A young mapmaker finds a coastline that appears on no official chart.",
    genre: "Adventure",
    author: "Ishaan P.",
    contributors: 31,
    rounds: 6,
    status: "In Progress",
    coverColor: "violet",
    chapters: 5,
    progress: 42,
  },
];

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
