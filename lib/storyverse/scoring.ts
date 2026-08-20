import type { ContributionScore, Story, ScoringWeights } from "@/lib/storyverse/types";
import { store, generateId } from "@/lib/storyverse/store";

/* ===================================================================
   CONTRIBUTION SCORE CALCULATION

   Formula:
   Canon Wins       = 40%
   Published Words  = 30%
   Vote Score       = 20%
   Participation    = 10%

   Weights are configurable via admin settings.
   =================================================================== */

export function calculateScores(storyId: string): ContributionScore[] {
  const story = store.stories.get(storyId);
  if (!story) return [];

  const weights = store.config.scoringWeights;
  const totalWeight = weights.canonWinsPercent + weights.publishedWordsPercent +
    weights.voteScorePercent + weights.participationPercent;

  if (totalWeight === 0) return [];

  // Find max values for normalization
  const maxCanonWins = Math.max(1, ...story.contributors.map((c) => c.canonWins));
  const maxWords = Math.max(1, ...story.contributors.map((c) => c.totalWordsAccepted));
  const maxVotes = Math.max(1, ...story.contributors.map((c) => c.totalVotesReceived));
  const maxContributions = Math.max(1, ...story.contributors.map((c) => c.totalContributions));

  const scores: ContributionScore[] = story.contributors.map((c) => {
    // Raw component scores (0-100)
    const canonWinScore = (c.canonWins / maxCanonWins) * 100;
    const publishedWordScore = (c.totalWordsAccepted / maxWords) * 100;
    const voteScore = (c.totalVotesReceived / maxVotes) * 100;
    const participationScore = (c.totalContributions / maxContributions) * 100;

    // Weighted total
    const totalScore = (
      canonWinScore * (weights.canonWinsPercent / totalWeight) +
      publishedWordScore * (weights.publishedWordsPercent / totalWeight) +
      voteScore * (weights.voteScorePercent / totalWeight) +
      participationScore * (weights.participationPercent / totalWeight)
    );

    return {
      userId: c.userId,
      storyId,
      canonWinScore,
      publishedWordScore,
      voteScore,
      participationScore,
      totalScore,
      sharePercent: 0, // calculated below
      calculatedAt: new Date().toISOString(),
    };
  });

  // Normalize share percentages
  const grandTotal = scores.reduce((sum, s) => sum + s.totalScore, 0) || 1;
  for (const s of scores) {
    s.sharePercent = Math.round((s.totalScore / grandTotal) * 1000) / 10;
  }

  // Store scores
  for (const s of scores) {
    store.scores.set(`${storyId}-${s.userId}`, s);
  }

  return scores;
}

export function getScores(storyId: string): ContributionScore[] {
  const story = store.stories.get(storyId);
  if (!story) return [];

  return story.contributors.map((c) => {
    const key = `${storyId}-${c.userId}`;
    return store.scores.get(key);
  }).filter((s): s is ContributionScore => s !== undefined);
}

export function getScoreForUser(storyId: string, userId: string): ContributionScore | undefined {
  return store.scores.get(`${storyId}-${userId}`);
}
