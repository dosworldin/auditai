import type { AbuseFlag, CountryStats, LeaderboardEntry } from "@/lib/storyverse/types";
import { store, generateId } from "@/lib/storyverse/store";

/* ===================================================================
   ANTI-ABUSE

   Prevent: self-voting, duplicate votes, suspended-user participation,
   vote manipulation, sybil abuse, fake contribution farming.
   =================================================================== */

export function flagAbuse(
  userId: string,
  storyId: string,
  flagType: AbuseFlag["flagType"],
  details: string,
): AbuseFlag {
  const flag: AbuseFlag = {
    id: generateId("abuse"),
    userId,
    storyId,
    flagType,
    details,
    detectedAt: new Date().toISOString(),
    resolved: false,
  };
  store.abuseFlags.push(flag);
  return flag;
}

export function resolveAbuseFlag(
  flagId: string,
  resolution: string,
): { ok: boolean; error?: string } {
  const flag = store.abuseFlags.find((f) => f.id === flagId);
  if (!flag) return { ok: false, error: "Flag not found" };
  flag.resolved = true;
  flag.resolution = resolution;
  return { ok: true };
}

export function getAbuseFlags(storyId?: string): AbuseFlag[] {
  if (storyId) return store.abuseFlags.filter((f) => f.storyId === storyId);
  return [...store.abuseFlags];
}

export function getSuspiciousPatterns(): AbuseFlag[] {
  // Return unresolved flags grouped by user
  return store.abuseFlags.filter((f) => !f.resolved);
}

/**
 * Detect self-voting patterns for a story.
 */
export function detectSelfVoting(storyId: string): { userId: string; count: number }[] {
  const votes = [...store.votes.values()].filter((v) => v.storyId === storyId);
  const violations: Map<string, number> = new Map();

  for (const vote of votes) {
    const contribution = store.contributions.get(vote.contributionId);
    if (contribution && contribution.authorId === vote.voterId) {
      violations.set(vote.voterId, (violations.get(vote.voterId) ?? 0) + 1);
    }
  }

  return [...violations.entries()].map(([userId, count]) => ({ userId, count }));
}

/**
 * Detect duplicate voting patterns (same user, same round, multiple votes).
 */
export function detectDuplicateVoting(storyId: string): { voterId: string; roundId: string; count: number }[] {
  const votes = [...store.votes.values()].filter((v) => v.storyId === storyId);
  const roundVotes = new Map<string, Map<string, number>>();

  for (const vote of votes) {
    if (!roundVotes.has(vote.voterId)) roundVotes.set(vote.voterId, new Map());
    const userRounds = roundVotes.get(vote.voterId)!;
    userRounds.set(vote.roundId, (userRounds.get(vote.roundId) ?? 0) + 1);
  }

  const violations: { voterId: string; roundId: string; count: number }[] = [];
  for (const [userId, rounds] of roundVotes) {
    for (const [roundId, count] of rounds) {
      if (count > store.config.maxVotesPerUserPerRound) {
        violations.push({ voterId: userId, roundId, count });
      }
    }
  }
  return violations;
}

/* ===================================================================
   GEO / COMMUNITY
   =================================================================== */

export function getCountryStats(): CountryStats[] {
  const stats = new Map<string, CountryStats>();

  for (const story of store.stories.values()) {
    // Story origin country
    if (story.originCountry) {
      const s = stats.get(story.originCountry) ?? {
        country: story.originCountry,
        contributorCount: 0,
        storyCount: 0,
        totalContributions: 0,
        totalCanonWins: 0,
      };
      s.storyCount++;
      stats.set(story.originCountry, s);
    }

    // Contributor countries
    for (const contrib of story.contributors) {
      if (!contrib.country) continue;
      const s = stats.get(contrib.country) ?? {
        country: contrib.country,
        contributorCount: 0,
        storyCount: 0,
        totalContributions: 0,
        totalCanonWins: 0,
      };
      s.contributorCount++;
      s.totalContributions += contrib.totalContributions;
      s.totalCanonWins += contrib.canonWins;
      stats.set(contrib.country, s);
    }
  }

  return [...stats.values()].sort((a, b) => b.contributorCount - a.contributorCount);
}

export function getLeaderboard(): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>();

  for (const story of store.stories.values()) {
    for (const contrib of story.contributors) {
      const existing = entries.get(contrib.userId) ?? {
        userId: contrib.userId,
        displayName: contrib.displayName,
        country: contrib.country,
        totalScore: 0,
        canonWins: 0,
        storiesContributed: 0,
      };
      existing.totalScore += contrib.totalContributions + contrib.canonWins * 10;
      existing.canonWins += contrib.canonWins;
      existing.storiesContributed++;
      entries.set(contrib.userId, existing);
    }
  }

  return [...entries.values()].sort((a, b) => b.totalScore - a.totalScore);
}
