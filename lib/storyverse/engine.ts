/**
 * StoryVerse Business Logic Engine
 *
 * Complete collaborative publishing platform engine.
 * All modules are in-memory for blueprint phase; real DB persistence
 * will replace the store layer in future phases.
 */

/* Types */
export type {
  Story,
  StoryType,
  StoryLifecycleStatus,
  Chapter,
  StoryRound,
  RoundStatus,
  StoryContributor,
  ContributorRole,
  Contribution,
  ContributionStatus,
  Vote,
  VoteType,
  CanonResult,
  PublicationReview,
  PublicationDecision,
  RevisionProposal,
  RevisionStatus,
  PublicationSnapshot,
  ContributorShare,
  MarketplaceListing,
  Purchase,
  LibraryEntry,
  ScoringWeights,
  ContributionScore,
  LedgerEntry,
  LedgerEventType,
  RevenueEntry,
  RevenueDistribution,
  AuthorWallet,
  WalletTransaction,
  PayoutRequest,
  PayoutMethod,
  StoryInvitation,
  VotingTokenPackage,
  VotingTokenBalance,
  AiPolishRequest,
  StoryVerseConfig,
  CountryStats,
  LeaderboardEntry,
  AbuseFlag,
  /* Phase 2 types */
  AiEditorRequest,
  AiContinuityResult,
  AiEditorStatus,
  CopyrightAnalysis,
  CopyrightRiskLevel,
  CopyrightMatchSegment,
  ContributorAgreement,
  ExclusivePublishingException,
  PoolInactivityState,
  PoolInactivityStatus,
  SoloInvitationPayment,
  SoloInvitationPaymentStatus,
} from "@/lib/storyverse/types";

/* Config */
export { DEFAULT_STORYVERSE_CONFIG } from "@/lib/storyverse/config";

/* Store */
export {
  store,
  getStory,
  getAllStories,
  getStoriesByStatus,
  getStoriesByOwner,
  generateId,
  getAiEditorRequest,
  addAiEditorRequest,
  getAiEditorRequestsByStory,
  addCopyrightAnalysis,
  getCopyrightAnalysis,
  getContributorAgreement,
  hasAcceptedAgreement,
  addContributorAgreement,
  addSoloInvitationPayment,
  getSoloInvitationPayment,
} from "@/lib/storyverse/store";

/* Lifecycle */
export {
  createStory,
  activateStory,
  startNewRound,
  beginRoundVoting,
  transitionStory,
  canTransition,
  checkStoryComplete,
} from "@/lib/storyverse/lifecycle";
export type { CreateStoryInput } from "@/lib/storyverse/lifecycle";

/* Contributions & Voting */
export {
  submitContribution,
  castVote,
  selectCanon,
} from "@/lib/storyverse/contributions";
export type { SubmitContributionInput, CastVoteInput } from "@/lib/storyverse/contributions";

/* Publication */
export {
  initiatePublicationReview,
  castPublicationVote,
  proposeRevision,
  castRevisionVote,
  createPublicationSnapshot,
} from "@/lib/storyverse/publication";

/* Scoring */
export {
  calculateScores,
  getScores,
  getScoreForUser,
} from "@/lib/storyverse/scoring";

/* Revenue */
export {
  processBookSale,
  processPaidVoteRevenue,
  requestPayout,
  grantCoAuthorAccess,
  listOnMarketplace,
} from "@/lib/storyverse/revenue";

/* Invitations (with paid solo invitations) */
export {
  sendInvitation,
  acceptInvitation,
  declineInvitation,
  getInvitationsForStory,
  getInvitationsForUser,
  getInvitationPrice,
} from "@/lib/storyverse/invitations";
export type { SendInvitationInput } from "@/lib/storyverse/invitations";

/* Paid Voting Tokens */
export {
  TOKEN_PACKAGES,
  purchaseTokens,
  getTokenBalance,
  getTokenTransactions,
} from "@/lib/storyverse/paidVoting";

/* AI Polish */
export {
  requestAiPolish,
  completeAiPolish,
} from "@/lib/storyverse/aiPolish";

/* AI Editor (post-voting continuity + copyright) */
export {
  runAiEditor,
  respondToAiEditorRewrite,
} from "@/lib/storyverse/aiEditor";
export type { RunAiEditorInput, AiEditorResult, ApproveRewriteInput } from "@/lib/storyverse/aiEditor";

/* Pool Inactivity */
export {
  checkPoolInactivity,
  startInactivityHold,
  archiveForInactivity,
  recoverFromInactivity,
  updateInactivityActivity,
  getInactivityStories,
} from "@/lib/storyverse/inactivity";

/* Legal (Contributor Agreement + Exclusive Publishing) */
export {
  acceptContributorAgreement,
  hasCurrentAgreement,
  getUserAgreement,
  getAllAgreements,
  isBoundByExclusivity,
  grantExclusivityException,
  validateContributionEligibility,
  CURRENT_AGREEMENT_VERSION,
  AGREEMENT_TEXT_HASH,
  AGREEMENT_SUMMARY,
} from "@/lib/storyverse/legal";

/* Anti-abuse & Geo */
export {
  flagAbuse,
  resolveAbuseFlag,
  getAbuseFlags,
  getSuspiciousPatterns,
  detectSelfVoting,
  detectDuplicateVoting,
  getCountryStats,
  getLeaderboard,
} from "@/lib/storyverse/abuse";
