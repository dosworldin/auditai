import type {
  Story,
  Contribution,
  Vote,
  CanonResult,
  LedgerEntry,
  RevenueEntry,
  Purchase,
  LibraryEntry,
  AuthorWallet,
  PayoutRequest,
  StoryInvitation,
  VotingTokenBalance,
  VotingTokenTransaction,
  AiPolishRequest,
  AbuseFlag,
  ContributionScore,
  StoryVerseState,
  AiEditorRequest,
  CopyrightAnalysis,
  ContributorAgreement,
  SoloInvitationPayment,
} from "@/lib/storyverse/types";
import { DEFAULT_STORYVERSE_CONFIG } from "@/lib/storyverse/config";

/* ------------------------------------------------------------------ */
/*  ID generation                                                      */
/* ------------------------------------------------------------------ */

let _counter = 1000;
function uid(prefix: string): string {
  return `${prefix}-${String(++_counter).padStart(6, "0")}`;
}

export function generateId(prefix: string): string {
  return uid(prefix);
}

/* ------------------------------------------------------------------ */
/*  Global in-memory store                                              */
/* ------------------------------------------------------------------ */

export const store: StoryVerseState = {
  stories: new Map(),
  contributions: new Map(),
  votes: new Map(),
  canonResults: new Map(),
  ledger: [],
  revenue: [],
  purchases: [],
  library: [],
  wallets: new Map(),
  payoutRequests: [],
  invitations: new Map(),
  tokenBalances: new Map(),
  tokenTransactions: [],
  aiPolishRequests: new Map(),
  abuseFlags: [],
  scores: new Map(),
  config: { ...DEFAULT_STORYVERSE_CONFIG },
  aiEditorRequests: new Map(),
  copyrightAnalyses: new Map(),
  contributorAgreements: new Map(),
  soloInvitationPayments: new Map(),
};

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const SEED_USERS = [
  { id: "user-001", displayName: "Maya R.", country: "India" },
  { id: "user-002", displayName: "Dev K.", country: "India" },
  { id: "user-003", displayName: "Anaya S.", country: "Canada" },
  { id: "user-004", displayName: "Rohan T.", country: "United States" },
  { id: "user-005", displayName: "Ishaan P.", country: "United Kingdom" },
  { id: "user-006", displayName: "Kiran V.", country: "Australia" },
  { id: "user-007", displayName: "Priya L.", country: "India" },
];

function seedStore() {
  if (store.stories.size > 0) return; // already seeded

  // Seed stories
  const stories: Story[] = [
    {
      id: "story-001",
      title: "The Lighthouse Keeper",
      description: "A reclusive lighthouse keeper discovers a journal that predicts every storm before it arrives.",
      genre: "Mystery",
      language: "English",
      storyType: "pool_open",
      ownerId: "user-001",
      status: "ACTIVE",
      chapters: [
        { id: "ch-001", storyId: "story-001", number: 1, title: "The Storm Bell", content: "The lighthouse stood at the edge of the world, or so it seemed to Thomas. For thirty years he had kept the light, watching the sea reveal its moods like pages of a living book...", canonContributionIds: ["contrib-001"], wordCount: 1200, createdAt: "2026-07-01T10:00:00Z", updatedAt: "2026-07-15T14:00:00Z" },
        { id: "ch-002", storyId: "story-001", number: 2, title: "The Journal", content: "It was hidden beneath a loose stone in the keeper's quarters, wrapped in oilcloth and sealed with wax that had yellowed with age...", canonContributionIds: ["contrib-003"], wordCount: 980, createdAt: "2026-07-15T14:00:00Z", updatedAt: "2026-07-28T09:00:00Z" },
      ],
      contributors: [
        { userId: "user-001", displayName: "Maya R.", country: "India", role: "owner", joinedAt: "2026-07-01T10:00:00Z", totalContributions: 5, canonWins: 2, totalVotesReceived: 47, totalWordsAccepted: 2180 },
        { userId: "user-006", displayName: "Kiran V.", country: "Australia", role: "co_author", joinedAt: "2026-07-02T12:00:00Z", totalContributions: 4, canonWins: 1, totalVotesReceived: 63, totalWordsAccepted: 1500 },
        { userId: "user-007", displayName: "Priya L.", country: "India", role: "contributor", joinedAt: "2026-07-03T08:00:00Z", totalContributions: 3, canonWins: 0, totalVotesReceived: 81, totalWordsAccepted: 0 },
      ],
      rounds: [
        { id: "rnd-001", storyId: "story-001", roundNumber: 1, status: "COMPLETE", chapterId: "ch-001", contributionIds: ["contrib-001"], canonContributionId: "contrib-001", createdAt: "2026-07-01T10:00:00Z", completedAt: "2026-07-10T10:00:00Z" },
        { id: "rnd-002", storyId: "story-001", roundNumber: 2, status: "COMPLETE", chapterId: "ch-002", contributionIds: ["contrib-002", "contrib-003"], canonContributionId: "contrib-003", createdAt: "2026-07-15T14:00:00Z", completedAt: "2026-07-28T09:00:00Z" },
        { id: "rnd-003", storyId: "storm-001", roundNumber: 3, status: "VOTING", chapterId: "ch-001", contributionIds: ["contrib-004", "contrib-005"], votingStartedAt: "2026-08-15T10:00:00Z", votingEndsAt: "2026-08-22T10:00:00Z", createdAt: "2026-08-15T10:00:00Z" },
      ],
      currentRound: 3,
      totalRounds: 7,
      coverColor: "indigo",
      createdAt: "2026-07-01T10:00:00Z",
      updatedAt: "2026-08-15T10:00:00Z",
      inviteRequired: false,
      originCountry: "India",
      tags: ["mystery", "lighthouse", "supernatural"],
    },
    {
      id: "story-002",
      title: "City of Broken Clocks",
      description: "In a city where time stopped at midnight, one young courier races to restart it.",
      genre: "Sci-Fi",
      language: "English",
      storyType: "pool_open",
      ownerId: "user-002",
      status: "PUBLICATION_REVIEW",
      chapters: [
        { id: "ch-010", storyId: "story-002", number: 1, title: "Midnight Freeze", content: "The clocks all stopped at 00:00. Every watch, every phone, every digital display on every wall in the city of Nova Chronos went dark simultaneously...", canonContributionIds: ["contrib-010"], wordCount: 1500, createdAt: "2026-05-01T10:00:00Z", updatedAt: "2026-06-15T14:00:00Z" },
      ],
      contributors: [
        { userId: "user-002", displayName: "Dev K.", country: "India", role: "owner", joinedAt: "2026-05-01T10:00:00Z", totalContributions: 12, canonWins: 5, totalVotesReceived: 320, totalWordsAccepted: 8500 },
        { userId: "user-003", displayName: "Anaya S.", country: "Canada", role: "co_author", joinedAt: "2026-05-02T12:00:00Z", totalContributions: 8, canonWins: 3, totalVotesReceived: 210, totalWordsAccepted: 4200 },
      ],
      rounds: Array.from({ length: 12 }, (_, i) => ({
        id: `rnd-0${i + 10}`,
        storyId: "story-002",
        roundNumber: i + 1,
        status: "COMPLETE" as const,
        chapterId: `ch-0${i + 10}`,
        contributionIds: [`contrib-0${i + 10}`],
        canonContributionId: `contrib-0${i + 10}`,
        createdAt: new Date(2026, 4, 1 + i * 7).toISOString(),
        completedAt: new Date(2026, 4, 8 + i * 7).toISOString(),
      })),
      currentRound: 12,
      totalRounds: 12,
      coverColor: "teal",
      createdAt: "2026-05-01T10:00:00Z",
      updatedAt: "2026-08-01T10:00:00Z",
      publicationReview: {
        storyId: "story-002",
        status: "voting",
        votes: [
          { userId: "user-002", decision: "PUBLISH_AS_IS", createdAt: "2026-08-02T10:00:00Z" },
          { userId: "user-003", decision: "PUBLISH_AS_IS", createdAt: "2026-08-02T12:00:00Z" },
        ],
        startedAt: "2026-08-01T10:00:00Z",
      },
      inviteRequired: false,
      originCountry: "India",
      tags: ["sci-fi", "time", "adventure"],
    },
    {
      id: "story-003",
      title: "The Orchard of Echoes",
      description: "Three sisters inherit an orchard where every fruit tastes like a memory.",
      genre: "Fantasy",
      language: "English",
      storyType: "pool_private",
      ownerId: "user-003",
      status: "ACTIVE",
      chapters: [
        { id: "ch-020", storyId: "story-003", number: 1, title: "The Inheritance", content: "The lawyer's letter arrived on a Tuesday, smelling faintly of lavender and old paper...", canonContributionIds: ["contrib-020"], wordCount: 800, createdAt: "2026-08-01T10:00:00Z", updatedAt: "2026-08-10T14:00:00Z" },
      ],
      contributors: [
        { userId: "user-003", displayName: "Anaya S.", country: "Canada", role: "owner", joinedAt: "2026-08-01T10:00:00Z", totalContributions: 2, canonWins: 1, totalVotesReceived: 15, totalWordsAccepted: 800 },
      ],
      rounds: [
        { id: "rnd-020", storyId: "story-003", roundNumber: 1, status: "COMPLETE", chapterId: "ch-020", contributionIds: ["contrib-020"], canonContributionId: "contrib-020", createdAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-10T14:00:00Z" },
      ],
      currentRound: 2,
      totalRounds: 5,
      coverColor: "amber",
      createdAt: "2026-08-01T10:00:00Z",
      updatedAt: "2026-08-15T10:00:00Z",
      inviteRequired: true,
      originCountry: "Canada",
      tags: ["fantasy", "family", "magic"],
    },
    {
      id: "story-004",
      title: "Midnight at Cafe Luna",
      description: "Regulars at a late-night cafe realize their orders always predict their futures.",
      genre: "Slice of Life",
      language: "English",
      storyType: "pool_open",
      ownerId: "user-004",
      status: "MARKETPLACE",
      chapters: Array.from({ length: 12 }, (_, i) => ({
        id: `ch-0${i + 30}`,
        storyId: "story-004",
        number: i + 1,
        title: `Chapter ${i + 1}`,
        content: `The cafe door chimed at exactly midnight as it always did...`,
        canonContributionIds: [`contrib-0${i + 30}`],
        wordCount: 1000 + Math.floor(Math.random() * 500),
        createdAt: new Date(2026, 0, 1 + i * 7).toISOString(),
        updatedAt: new Date(2026, 0, 8 + i * 7).toISOString(),
      })),
      contributors: [
        { userId: "user-004", displayName: "Rohan T.", country: "United States", role: "owner", joinedAt: "2026-01-01T10:00:00Z", totalContributions: 15, canonWins: 8, totalVotesReceived: 420, totalWordsAccepted: 12000 },
        { userId: "user-005", displayName: "Ishaan P.", country: "United Kingdom", role: "co_author", joinedAt: "2026-01-02T12:00:00Z", totalContributions: 10, canonWins: 4, totalVotesReceived: 280, totalWordsAccepted: 6000 },
        { userId: "user-006", displayName: "Kiran V.", country: "Australia", role: "contributor", joinedAt: "2026-01-03T08:00:00Z", totalContributions: 6, canonWins: 0, totalVotesReceived: 150, totalWordsAccepted: 0 },
      ],
      rounds: Array.from({ length: 9 }, (_, i) => ({
        id: `rnd-0${i + 30}`,
        storyId: "story-004",
        roundNumber: i + 1,
        status: "COMPLETE" as const,
        chapterId: `ch-0${i + 30}`,
        contributionIds: [`contrib-0${i + 30}`],
        canonContributionId: `contrib-0${i + 30}`,
        createdAt: new Date(2026, 0, 1 + i * 7).toISOString(),
        completedAt: new Date(2026, 0, 8 + i * 7).toISOString(),
      })),
      currentRound: 9,
      totalRounds: 9,
      coverColor: "rose",
      createdAt: "2026-01-01T10:00:00Z",
      updatedAt: "2026-06-01T10:00:00Z",
      publicationSnapshot: {
        storyId: "story-004",
        publishedAt: "2026-06-15T10:00:00Z",
        contributorShares: [
          { userId: "user-004", displayName: "Rohan T.", country: "United States", sharePercent: 55, contributionScore: 85, canonWins: 8, wordsAccepted: 12000, totalVotesReceived: 420, contributionsCount: 15 },
          { userId: "user-005", displayName: "Ishaan P.", country: "United Kingdom", sharePercent: 35, contributionScore: 62, canonWins: 4, wordsAccepted: 6000, totalVotesReceived: 280, contributionsCount: 10 },
          { userId: "user-006", displayName: "Kiran V.", country: "Australia", sharePercent: 10, contributionScore: 28, canonWins: 0, wordsAccepted: 0, totalVotesReceived: 150, contributionsCount: 6 },
        ],
        totalAcceptedWords: 14500,
        platformRevenuePercent: 30,
        authorPoolRevenuePercent: 70,
        contentHash: "sha256:seed-cafe-luna",
        chapterCount: 12,
        totalRounds: 9,
        immutable: true,
      },
      marketplace: {
        storyId: "story-004",
        price: 4.99,
        currency: "USD",
        listedAt: "2026-06-20T10:00:00Z",
        totalSales: 156,
        totalRevenue: 778.44,
        previewText: "The cafe door chimed at exactly midnight as it always did. Luna looked up from the espresso machine, her eyes catching the clock: 00:00. Right on time...",
        previewWordCount: 250,
      },
      inviteRequired: false,
      originCountry: "United States",
      tags: ["slice-of-life", "cafe", "mystical"],
    },
    {
      id: "story-005",
      title: "The Cartographer's Daughter",
      description: "A young mapmaker finds a coastline that appears on no official chart.",
      genre: "Adventure",
      language: "English",
      storyType: "solo_open",
      ownerId: "user-005",
      status: "ACTIVE",
      chapters: [
        { id: "ch-050", storyId: "story-005", number: 1, title: "The Uncharted Coast", content: "Her father's maps covered every wall of the workshop, from the frozen straits of the north to the sunbaked coasts of the south...", canonContributionIds: ["contrib-050"], wordCount: 1100, createdAt: "2026-06-01T10:00:00Z", updatedAt: "2026-06-15T14:00:00Z" },
      ],
      contributors: [
        { userId: "user-005", displayName: "Ishaan P.", country: "United Kingdom", role: "owner", joinedAt: "2026-06-01T10:00:00Z", totalContributions: 3, canonWins: 1, totalVotesReceived: 20, totalWordsAccepted: 1100 },
      ],
      rounds: [
        { id: "rnd-050", storyId: "story-005", roundNumber: 1, status: "COMPLETE", chapterId: "ch-050", contributionIds: ["contrib-050"], canonContributionId: "contrib-050", createdAt: "2026-06-01T10:00:00Z", completedAt: "2026-06-15T14:00:00Z" },
      ],
      currentRound: 2,
      totalRounds: 6,
      coverColor: "violet",
      createdAt: "2026-06-01T10:00:00Z",
      updatedAt: "2026-08-15T10:00:00Z",
      inviteRequired: false,
      originCountry: "United Kingdom",
      tags: ["adventure", "maps", "discovery"],
    },
  ];

  for (const s of stories) {
    store.stories.set(s.id, s);
  }

  // Seed wallets
  for (const user of SEED_USERS) {
    store.wallets.set(user.id, {
      userId: user.id,
      totalEarned: Math.floor(Math.random() * 500) + 50,
      pendingBalance: Math.floor(Math.random() * 100),
      availableBalance: Math.floor(Math.random() * 300) + 20,
      totalPayouts: Math.floor(Math.random() * 200),
      storyEarnings: [],
      transactions: [],
    });
  }

  // Seed token balances
  for (const user of SEED_USERS) {
    store.tokenBalances.set(user.id, {
      userId: user.id,
      balance: 5 + Math.floor(Math.random() * 20),
      totalPurchased: Math.floor(Math.random() * 30),
      totalUsed: Math.floor(Math.random() * 15),
    });
  }

  // Seed some library entries
  store.library.push(
    { userId: "user-001", storyId: "story-004", accessType: "purchased", addedAt: "2026-07-01T10:00:00Z" },
    { userId: "user-002", storyId: "story-004", accessType: "co_author", addedAt: "2026-06-15T10:00:00Z" },
    { userId: "user-006", storyId: "story-004", accessType: "co_author", addedAt: "2026-06-15T10:00:00Z" },
  );
}

// Initialize seed data on first import
seedStore();

/* ------------------------------------------------------------------ */
/*  Store helpers                                                      */
/* ------------------------------------------------------------------ */

export function getStory(id: string): Story | undefined {
  return store.stories.get(id);
}

export function getAllStories(): Story[] {
  return [...store.stories.values()];
}

export function getStoriesByStatus(status: Story["status"]): Story[] {
  return getAllStories().filter((s) => s.status === status);
}

export function getStoriesByOwner(ownerId: string): Story[] {
  return getAllStories().filter((s) => s.ownerId === ownerId);
}

export function addStory(story: Story): void {
  store.stories.set(story.id, story);
}

export function updateStory(id: string, updater: (s: Story) => Story): Story | undefined {
  const story = store.stories.get(id);
  if (!story) return undefined;
  const updated = updater(story);
  store.stories.set(id, updated);
  return updated;
}

export function getContribution(id: string): Contribution | undefined {
  return store.contributions.get(id);
}

export function getContributionsByRound(roundId: string): Contribution[] {
  return [...store.contributions.values()].filter((c) => c.roundId === roundId);
}

export function addContribution(c: Contribution): void {
  store.contributions.set(c.id, c);
}

export function getVotesByContribution(contributionId: string): Vote[] {
  return [...store.votes.values()].filter((v) => v.contributionId === contributionId);
}

export function getVotesByRound(roundId: string): Vote[] {
  return [...store.votes.values()].filter((v) => v.roundId === roundId);
}

export function addVote(v: Vote): void {
  store.votes.set(v.id, v);
}

export function addLedgerEntry(entry: LedgerEntry): void {
  store.ledger.push(entry);
}

export function getLedgerByStory(storyId: string): LedgerEntry[] {
  return store.ledger.filter((e) => e.storyId === storyId);
}

export function getWallet(userId: string): AuthorWallet {
  let w = store.wallets.get(userId);
  if (!w) {
    w = { userId, totalEarned: 0, pendingBalance: 0, availableBalance: 0, totalPayouts: 0, storyEarnings: [], transactions: [] };
    store.wallets.set(userId, w);
  }
  return w;
}

export function addRevenueEntry(entry: RevenueEntry): void {
  store.revenue.push(entry);
}

export function getRevenueByStory(storyId: string): RevenueEntry[] {
  return store.revenue.filter((r) => r.storyId === storyId);
}

export function addPurchase(p: Purchase): void {
  store.purchases.push(p);
}

export function getLibraryForUser(userId: string): LibraryEntry[] {
  return store.library.filter((l) => l.userId === userId);
}

export function hasLibraryAccess(userId: string, storyId: string): boolean {
  return store.library.some((l) => l.userId === userId && l.storyId === storyId);
}

export function addLibraryEntry(entry: LibraryEntry): void {
  store.library.push(entry);
}

export function getTokenBalance(userId: string): VotingTokenBalance {
  let b = store.tokenBalances.get(userId);
  if (!b) {
    b = { userId, balance: 0, totalPurchased: 0, totalUsed: 0 };
    store.tokenBalances.set(userId, b);
  }
  return b;
}

/* ------------------------------------------------------------------ */
/*  AI Editor helpers                                                  */
/* ------------------------------------------------------------------ */

export function getAiEditorRequest(id: string): AiEditorRequest | undefined {
  return store.aiEditorRequests.get(id);
}

export function addAiEditorRequest(req: AiEditorRequest): void {
  store.aiEditorRequests.set(req.id, req);
}

export function getAiEditorRequestsByStory(storyId: string): AiEditorRequest[] {
  return [...store.aiEditorRequests.values()].filter((r) => r.storyId === storyId);
}

/* ------------------------------------------------------------------ */
/*  Copyright helpers                                                  */
/* ------------------------------------------------------------------ */

export function addCopyrightAnalysis(analysis: CopyrightAnalysis): void {
  store.copyrightAnalyses.set(analysis.id, analysis);
}

export function getCopyrightAnalysis(id: string): CopyrightAnalysis | undefined {
  return store.copyrightAnalyses.get(id);
}

/* ------------------------------------------------------------------ */
/*  Contributor Agreement helpers                                      */
/* ------------------------------------------------------------------ */

export function getContributorAgreement(userId: string): ContributorAgreement | undefined {
  return [...store.contributorAgreements.values()].find((a) => a.userId === userId);
}

export function hasAcceptedAgreement(userId: string): boolean {
  return [...store.contributorAgreements.values()].some((a) => a.userId === userId && a.accepted);
}

export function addContributorAgreement(agreement: ContributorAgreement): void {
  store.contributorAgreements.set(agreement.id, agreement);
}

/* ------------------------------------------------------------------ */
/*  Solo Invitation Payment helpers                                    */
/* ------------------------------------------------------------------ */

export function addSoloInvitationPayment(payment: SoloInvitationPayment): void {
  store.soloInvitationPayments.set(payment.id, payment);
}

export function getSoloInvitationPayment(id: string): SoloInvitationPayment | undefined {
  return store.soloInvitationPayments.get(id);
}
