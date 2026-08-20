import type { StoryVerseConfig } from "@/lib/storyverse/types";

/**
 * Default StoryVerse platform configuration.
 * Admin can modify these; changes affect future activity only.
 * Historical publication snapshots remain immutable.
 */
export const DEFAULT_STORYVERSE_CONFIG: StoryVerseConfig = {
  /* Credit economy */
  creditValue: 0.10, // $0.10 per credit

  /* Voting */
  freeVotingAllowance: 10,
  paidVotePrice: 0.05, // $0.05 per paid vote token
  maxPaidVotesPerRound: 50,

  /* AI */
  aiPolishPrice: 5, // credits

  /* AI Editor */
  aiEditorPrice: 10, // credits for AI editor execution
  aiEditorEnabled: true,
  aiEditorContinuityEnabled: true,
  aiEditorCopyrightCheckEnabled: true,
  aiRewriteEnabled: true,

  /* Private invites */
  privateInvitePrice: 0, // free by default

  /* Archive / retention */
  archivePeriodDays: 365,
  deletePeriodDays: 730,
  retentionDays: 365,

  /* Pool inactivity */
  poolInactivityHoldDays: 7, // default 7 days, NOT hardcoded in logic

  /* Revenue split: Book sales */
  bookSalePlatformPercent: 30,
  bookSaleAuthorPoolPercent: 70,

  /* Revenue split: Paid voting tokens */
  paidVotePlatformPercent: 70,
  paidVoteAuthorPoolPercent: 30,

  /* Copyright similarity thresholds */
  copyrightSimilarityWarningThreshold: 40,
  copyrightHighSimilarityThreshold: 70,

  /* Contribution scoring weights */
  scoringWeights: {
    canonWinsPercent: 40,
    publishedWordsPercent: 30,
    voteScorePercent: 20,
    participationPercent: 10,
  },

  /* Story participation rules */
  minContributorsForPool: 2,
  maxContributorsPerRound: 20,
  minWordsPerContribution: 50,
  maxWordsPerContribution: 2000,

  /* Publication thresholds */
  minRoundsForCompletion: 3,
  publicationReviewVotingDays: 7,
  revisionReviewVotingDays: 5,

  /* Payout */
  minimumPayoutThreshold: 10, // $10 minimum

  /* Anti-abuse */
  maxVotesPerUserPerRound: 5,
  trustWeightEnabled: false,

  /* Country tracking */
  trackContributorCountry: true,
};

export function getConfig(): StoryVerseConfig {
  return { ...DEFAULT_STORYVERSE_CONFIG };
}
