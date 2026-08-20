/**
 * StoryVerse Domain Types
 *
 * All types used across the StoryVerse business logic engine.
 * These define the complete data model for the collaborative publishing platform.
 */

/* ===================================================================
   STORY
   =================================================================== */

export type StoryType = "pool_open" | "pool_private" | "solo_open" | "solo_ai";

export type StoryLifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ROUND_VOTING"
  | "CANON_SELECTED"
  | "NEXT_ROUND"
  | "STORY_COMPLETE"
  | "PUBLICATION_REVIEW"
  | "REVISION_REVIEW"
  | "PUBLICATION_SNAPSHOT"
  | "PUBLISHED"
  | "MARKETPLACE"
  | "ARCHIVED";

export interface Story {
  id: string;
  title: string;
  description: string;
  genre: string;
  language: string;
  storyType: StoryType;
  ownerId: string;
  status: StoryLifecycleStatus;
  chapters: Chapter[];
  contributors: StoryContributor[];
  rounds: StoryRound[];
  currentRound: number;
  totalRounds: number;
  coverColor: string;
  createdAt: string;
  updatedAt: string;
  /** Publication review state */
  publicationReview?: PublicationReview;
  /** Revision proposal (if revision workflow is active) */
  revisionProposal?: RevisionProposal;
  /** Frozen snapshot (set at publication) */
  publicationSnapshot?: PublicationSnapshot;
  /** Marketplace info (set when published + commercialized) */
  marketplace?: MarketplaceListing;
  /** Access control */
  inviteRequired: boolean;
  /** Country of origin for geo stats */
  originCountry?: string;
  /** Tags for discovery */
  tags: string[];
  /** Pool inactivity tracking */
  inactivityState?: PoolInactivityState;
  /** Contributor agreement version accepted at story creation */
  contributorAgreementVersion?: string;
}

/* ===================================================================
   CHAPTERS
   =================================================================== */

export interface Chapter {
  id: string;
  storyId: string;
  number: number;
  title: string;
  content: string;
  /** Canon contributions assembled into this chapter */
  canonContributionIds: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ===================================================================
   ROUNDS
   =================================================================== */

export type RoundStatus = "OPEN" | "VOTING" | "CANON_SELECTED" | "COMPLETE";

export interface StoryRound {
  id: string;
  storyId: string;
  roundNumber: number;
  status: RoundStatus;
  /** Chapter this round contributes to */
  chapterId: string;
  /** Contributions in this round */
  contributionIds: string[];
  /** Winning contribution */
  canonContributionId?: string;
  /** Voting window */
  votingStartedAt?: string;
  votingEndsAt?: string;
  createdAt: string;
  completedAt?: string;
}

/* ===================================================================
   CONTRIBUTORS
   =================================================================== */

export type ContributorRole = "owner" | "co_author" | "contributor" | "ai_assistant";

export interface StoryContributor {
  userId: string;
  displayName: string;
  country?: string;
  role: ContributorRole;
  joinedAt: string;
  /** Contribution stats */
  totalContributions: number;
  canonWins: number;
  totalVotesReceived: number;
  totalWordsAccepted: number;
}

/* ===================================================================
   CONTRIBUTIONS
   =================================================================== */

export type ContributionStatus =
  | "PENDING"
  | "VOTING"
  | "CANON"
  | "REJECTED"
  | "REVISED";

export interface Contribution {
  id: string;
  storyId: string;
  roundId: string;
  authorId: string;
  authorDisplayName: string;
  authorCountry?: string;
  content: string;
  wordCount: number;
  status: ContributionStatus;
  votes: number;
  isCanon: boolean;
  /** AI polishing status for Solo AI stories */
  aiPolishStatus: "none" | "requested" | "polished";
  createdAt: string;
  updatedAt: string;
}

/* ===================================================================
   VOTES
   =================================================================== */

export type VoteType = "free" | "paid";

export interface Vote {
  id: string;
  contributionId: string;
  storyId: string;
  roundId: string;
  voterId: string;
  voteType: VoteType;
  /** Weighted vote count (may be > 1 for reputation-weighted votes) */
  weight: number;
  /** Token amount if paid */
  tokenAmount?: number;
  createdAt: string;
}

/* ===================================================================
   CANON SELECTION
   =================================================================== */

export interface CanonResult {
  roundId: string;
  canonContributionId: string;
  totalVotes: number;
  /** Total votes received by the winning contribution */
  winnerVotes: number;
  /** Runner-up info */
  runnerUpId?: string;
  runnerUpVotes?: number;
  selectedAt: string;
}

/* ===================================================================
   PUBLICATION REVIEW
   =================================================================== */

export type PublicationDecision = "PUBLISH_AS_IS" | "NEEDS_REVISION";

export interface PublicationReview {
  storyId: string;
  status: "pending" | "voting" | "decided";
  votes: PublicationVote[];
  decision?: PublicationDecision;
  startedAt: string;
  decidedAt?: string;
}

export interface PublicationVote {
  userId: string;
  decision: PublicationDecision;
  createdAt: string;
}

/* ===================================================================
   REVISION PROPOSAL
   =================================================================== */

export type RevisionStatus = "proposed" | "voting" | "accepted" | "rejected" | "applied";

export interface RevisionProposal {
  id: string;
  storyId: string;
  proposerId: string;
  chapterId: string;
  /** Description of what needs changing */
  description: string;
  /** Suggested replacement content */
  proposedContent?: string;
  status: RevisionStatus;
  votes: RevisionVote[];
  createdAt: string;
  decidedAt?: string;
}

export interface RevisionVote {
  userId: string;
  decision: "accept" | "reject";
  createdAt: string;
}

/* ===================================================================
   PUBLICATION SNAPSHOT (IMMUTABLE)
   =================================================================== */

export interface PublicationSnapshot {
  storyId: string;
  publishedAt: string;
  /** Frozen contributor list with contribution percentages */
  contributorShares: ContributorShare[];
  /** Total accepted words */
  totalAcceptedWords: number;
  /** Platform/author revenue split (frozen at publication time) */
  platformRevenuePercent: number;
  authorPoolRevenuePercent: number;
  /** Content hash for integrity */
  contentHash: string;
  /** Chapters included */
  chapterCount: number;
  /** Total rounds completed */
  totalRounds: number;
  /** Immutable flag */
  immutable: true;
}

export interface ContributorShare {
  userId: string;
  displayName: string;
  country?: string;
  /** Percentage of author pool (0-100) */
  sharePercent: number;
  /** Raw contribution score at time of snapshot */
  contributionScore: number;
  canonWins: number;
  wordsAccepted: number;
  totalVotesReceived: number;
  contributionsCount: number;
}

/* ===================================================================
   MARKETPLACE
   =================================================================== */

export interface MarketplaceListing {
  storyId: string;
  price: number;
  /** 0 = free */
  currency: string;
  listedAt: string;
  totalSales: number;
  totalRevenue: number;
  previewText: string;
  previewWordCount: number;
}

export interface Purchase {
  id: string;
  storyId: string;
  buyerId: string;
  price: number;
  currency: string;
  purchasedAt: string;
}

/* ===================================================================
   LIBRARY
   =================================================================== */

export interface LibraryEntry {
  userId: string;
  storyId: string;
  /** How they got access */
  accessType: "purchased" | "co_author" | "free" | "gifted";
  addedAt: string;
  /** Last read position */
  lastReadChapter?: number;
}

/* ===================================================================
   CONTRIBUTION SCORING
   =================================================================== */

export interface ScoringWeights {
  canonWinsPercent: number;
  publishedWordsPercent: number;
  voteScorePercent: number;
  participationPercent: number;
}

export interface ContributionScore {
  userId: string;
  storyId: string;
  /** Breakdown */
  canonWinScore: number;
  publishedWordScore: number;
  voteScore: number;
  participationScore: number;
  /** Weighted total */
  totalScore: number;
  /** Percentage of total story score */
  sharePercent: number;
  calculatedAt: string;
}

/* ===================================================================
   REVENUE & LEDGER
   =================================================================== */

export type LedgerEventType =
  | "contribution"
  | "vote"
  | "canon_win"
  | "published_words"
  | "participation"
  | "publication_decision"
  | "book_sale"
  | "paid_vote_sale"
  | "revenue_distribution"
  | "payout_request"
  | "payout_completed"
  | "payout_rejected"
  | "revision_proposed"
  | "revision_vote"
  | "revision_applied"
  | "ai_polish_requested"
  | "ai_polish_completed"
  | "ai_editor_executed"
  | "ai_editor_continuity_check"
  | "ai_editor_copyright_check"
  | "ai_editor_rewrite_generated"
  | "ai_editor_rewrite_approved"
  | "ai_editor_rewrite_rejected"
  | "ai_editor_charged"
  | "invitation_sent"
  | "invitation_accepted"
  | "invitation_charged"
  | "invitation_expired"
  | "contributor_agreement_accepted"
  | "exclusivity_exception"
  | "pool_inactivity_hold"
  | "pool_inactivity_archive"
  | "story_lifecycle";

export interface LedgerEntry {
  id: string;
  eventType: LedgerEventType;
  storyId: string;
  roundId?: string;
  chapterId?: string;
  contributionId?: string;
  userId?: string;
  /** Event-specific data */
  metadata: Record<string, unknown>;
  timestamp: string;
  /** Append-only: no edits allowed */
  immutable: true;
}

export interface RevenueEntry {
  id: string;
  storyId: string;
  /** book_sale or paid_vote_sale */
  revenueType: "book_sale" | "paid_vote_sale";
  grossAmount: number;
  platformAmount: number;
  authorPoolAmount: number;
  /** Breakdown per author */
  distribution: RevenueDistribution[];
  currency: string;
  createdAt: string;
  /** Reference to ledger */
  ledgerEntryId: string;
  immutable: true;
}

export interface RevenueDistribution {
  userId: string;
  displayName: string;
  sharePercent: number;
  amount: number;
}

/* ===================================================================
   AUTHOR WALLET
   =================================================================== */

export type WalletTransactionType =
  | "book_revenue"
  | "paid_vote_revenue"
  | "payout"
  | "payout_reversed"
  | "token_purchase"
  | "token_refund";

export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTransactionType;
  amount: number;
  currency: string;
  description: string;
  storyId?: string;
  createdAt: string;
}

export interface AuthorWallet {
  userId: string;
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  totalPayouts: number;
  storyEarnings: StoryEarning[];
  transactions: WalletTransaction[];
}

export interface StoryEarning {
  storyId: string;
  storyTitle: string;
  sharePercent: number;
  totalEarned: number;
  contributionScore: number;
}

/* ===================================================================
   PAYOUT
   =================================================================== */

export type PayoutMethod = "upi" | "bank" | "paypal";
export type PayoutStatus = "pending" | "processing" | "completed" | "rejected" | "suspended";

export interface PayoutRequest {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  status: PayoutStatus;
  /** Account details (masked) */
  accountIdentifier: string;
  /** KYC verification */
  kycVerified: boolean;
  /** Fraud/security checks passed */
  securityCleared: boolean;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
  /** Audit trail */
  ledgerEntryId: string;
}

/* ===================================================================
   PRIVATE STORY INVITATIONS
   =================================================================== */

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export interface StoryInvitation {
  id: string;
  storyId: string;
  inviterId: string;
  inviteeId: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  /** Price for private invite (admin-configurable) */
  invitePrice: number;
}

/* ===================================================================
   PAID VOTING TOKENS
   =================================================================== */

export interface VotingTokenPackage {
  id: string;
  tokenCount: number;
  price: number;
  currency: string;
  label: string;
}

export interface VotingTokenBalance {
  userId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

export interface VotingTokenTransaction {
  id: string;
  userId: string;
  type: "purchase" | "vote_cast" | "refund";
  amount: number;
  /** Remaining balance after transaction */
  balanceAfter: number;
  description: string;
  voteId?: string;
  createdAt: string;
}

/* ===================================================================
   AI POLISH
   =================================================================== */

export interface AiPolishRequest {
  id: string;
  storyId: string;
  contributionId: string;
  authorId: string;
  /** Original content preserved */
  originalContent: string;
  /** AI-polished version */
  polishedContent?: string;
  status: "requested" | "processing" | "completed" | "failed";
  /** Cost in credits */
  creditsCost: number;
  createdAt: string;
  completedAt?: string;
}

/* ===================================================================
   ADMIN CONFIGURATION
   =================================================================== */

export interface StoryVerseConfig {
  /** Credit economy */
  creditValue: number;
  /** Voting */
  freeVotingAllowance: number;
  paidVotePrice: number;
  maxPaidVotesPerRound: number;
  /** AI */
  aiPolishPrice: number;
  /** AI Editor */
  aiEditorPrice: number;
  aiEditorEnabled: boolean;
  aiEditorContinuityEnabled: boolean;
  aiEditorCopyrightCheckEnabled: boolean;
  aiRewriteEnabled: boolean;
  /** Private invites */
  privateInvitePrice: number;
  /** Archive / retention */
  archivePeriodDays: number;
  deletePeriodDays: number;
  retentionDays: number;
  /** Pool inactivity */
  poolInactivityHoldDays: number;
  /** Revenue split for book sales */
  bookSalePlatformPercent: number;
  bookSaleAuthorPoolPercent: number;
  /** Revenue split for paid voting */
  paidVotePlatformPercent: number;
  paidVoteAuthorPoolPercent: number;
  /** Copyright similarity thresholds */
  copyrightSimilarityWarningThreshold: number;
  copyrightHighSimilarityThreshold: number;
  /** Contribution scoring weights */
  scoringWeights: ScoringWeights;
  /** Story participation rules */
  minContributorsForPool: number;
  maxContributorsPerRound: number;
  minWordsPerContribution: number;
  maxWordsPerContribution: number;
  /** Publication thresholds */
  minRoundsForCompletion: number;
  publicationReviewVotingDays: number;
  revisionReviewVotingDays: number;
  /** Payout */
  minimumPayoutThreshold: number;
  /** Anti-abuse */
  maxVotesPerUserPerRound: number;
  trustWeightEnabled: boolean;
  /** Country tracking */
  trackContributorCountry: boolean;
}

/* ===================================================================
   GEO / COMMUNITY
   =================================================================== */

export interface CountryStats {
  country: string;
  contributorCount: number;
  storyCount: number;
  totalContributions: number;
  totalCanonWins: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  country?: string;
  totalScore: number;
  canonWins: number;
  storiesContributed: number;
}

/* ===================================================================
   ANTI-ABUSE
   =================================================================== */

export interface AbuseFlag {
  id: string;
  userId: string;
  storyId: string;
  /** Self-voting, duplicate vote, sybil, etc. */
  flagType: "self_vote" | "duplicate_vote" | "sybil_suspect" | "vote_manipulation" | "fake_contribution";
  details: string;
  detectedAt: string;
  resolved: boolean;
  resolution?: string;
}

/* ===================================================================
   AI EDITOR (Post-Voting)
   =================================================================== */

export type AiEditorStatus = "pending" | "running" | "continuity_passed" | "continuity_failed" | "copyright_clear" | "copyright_warning" | "copyright_high_review" | "rewrite_pending" | "rewrite_approved" | "rewrite_rejected" | "completed" | "failed";

export interface AiEditorRequest {
  id: string;
  storyId: string;
  contributionId: string;
  roundId: string;
  authorId: string;
  /** Original content before AI editor */
  originalContent: string;
  /** AI continuity check result */
  continuityResult?: AiContinuityResult;
  /** Copyright similarity analysis */
  copyrightResult?: CopyrightAnalysis;
  /** AI-suggested rewrite (if material revision needed) */
  suggestedRewrite?: string;
  /** Author-approved final content */
  approvedContent?: string;
  status: AiEditorStatus;
  /** Cost in credits */
  creditsCost: number;
  createdAt: string;
  completedAt?: string;
}

export interface AiContinuityResult {
  passed: boolean;
  grammarOk: boolean;
  characterConsistency: boolean;
  timelineConsistency: boolean;
  locationConsistency: boolean;
  canonContinuity: boolean;
  contradictions: string[];
  suggestions: string[];
  materialRevisionProposed: boolean;
}

/* ===================================================================
   COPYRIGHT SIMILARITY / RISK DETECTION
   =================================================================== */

export type CopyrightRiskLevel = "CLEAR" | "SIMILARITY_WARNING" | "HIGH_SIMILARITY_REVIEW";

export interface CopyrightAnalysis {
  id: string;
  storyId: string;
  contributionId: string;
  /** Similarity score 0-100 */
  similarityScore: number;
  riskLevel: CopyrightRiskLevel;
  /** AI disclaimer: this is NOT a legal determination */
  disclaimer: string;
  /** Matching text segments found */
  matchingSegments: CopyrightMatchSegment[];
  /** Suggested substantially original rewrite */
  suggestedRewrite?: string;
  /** Original content preserved */
  originalContent: string;
  /** Final approved version */
  finalApprovedContent?: string;
  /** Author approval status */
  authorApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface CopyrightMatchSegment {
  text: string;
  similarityPercent: number;
  source: string;
}

/* ===================================================================
   CONTRIBUTOR AGREEMENT
   =================================================================== */

export interface ContributorAgreement {
  id: string;
  userId: string;
  /** Agreement version for immutability */
  agreementVersion: string;
  /** Full text hash */
  agreementTextHash: string;
  /** Acceptance timestamp */
  acceptedAt: string;
  /** User explicitly accepted */
  accepted: boolean;
  /** Covers: publishing, digital distribution, commercial sale, editing/polishing,
   * compilation, marketing/promotion, licensing/distribution rights,
   * contributor attribution, contributor revenue share,
   * restrictions on independent publication/distribution */
}

export interface ExclusivePublishingException {
  id: string;
  userId: string;
  storyId: string;
  grantedBy: string;
  reason: string;
  grantedAt: string;
  ledgerEntryId: string;
}

/* ===================================================================
   POOL STORY INACTIVITY
   =================================================================== */

export type PoolInactivityStatus = "active" | "hold" | "archived" | "recovered";

export interface PoolInactivityState {
  status: PoolInactivityStatus;
  /** When the story entered hold */
  holdStartedAt?: string;
  /** When the story was archived */
  archivedAt?: string;
  /** When the story was recovered */
  recoveredAt?: string;
  /** Last activity (contribution or join) */
  lastActivityAt: string;
  /** Original author can resume during hold */
  holdReason?: string;
}

/* ===================================================================
   SOLO INVITATION PAYMENT
   =================================================================== */

export type SoloInvitationPaymentStatus = "pending" | "charged" | "refunded" | "failed";

export interface SoloInvitationPayment {
  id: string;
  invitationId: string;
  storyId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  status: SoloInvitationPaymentStatus;
  /** Reference to ledger entry */
  ledgerEntryId: string;
  createdAt: string;
  chargedAt?: string;
  refundedAt?: string;
}

/* ===================================================================
   STORYVERSE COMBINED STATE
   =================================================================== */

export interface StoryVerseState {
  stories: Map<string, Story>;
  contributions: Map<string, Contribution>;
  votes: Map<string, Vote>;
  canonResults: Map<string, CanonResult>;
  ledger: LedgerEntry[];
  revenue: RevenueEntry[];
  purchases: Purchase[];
  library: LibraryEntry[];
  wallets: Map<string, AuthorWallet>;
  payoutRequests: PayoutRequest[];
  invitations: Map<string, StoryInvitation>;
  tokenBalances: Map<string, VotingTokenBalance>;
  tokenTransactions: VotingTokenTransaction[];
  aiPolishRequests: Map<string, AiPolishRequest>;
  abuseFlags: AbuseFlag[];
  scores: Map<string, ContributionScore>;
  config: StoryVerseConfig;
  /** AI Editor requests (post-voting continuity + copyright) */
  aiEditorRequests: Map<string, AiEditorRequest>;
  /** Copyright similarity analyses */
  copyrightAnalyses: Map<string, CopyrightAnalysis>;
  /** Contributor agreements accepted */
  contributorAgreements: Map<string, ContributorAgreement>;
  /** Solo invitation payments */
  soloInvitationPayments: Map<string, SoloInvitationPayment>;
}
