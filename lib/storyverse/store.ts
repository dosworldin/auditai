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
/*  Global in-memory store (sync cache — real data in Supabase)         */
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
/*  Store helpers (used by StoryVerse engine modules)                   */
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
