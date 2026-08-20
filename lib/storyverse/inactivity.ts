/**
 * Pool Story Inactivity Module
 *
 * If a Pool Story has only one contributor and nobody else joins:
 *   1. Do not delete immediately.
 *   2. Create an Admin-configurable inactivity/hold period.
 *   3. DEFAULT: 7 days (NOT hardcoded — read from store.config.poolInactivityHoldDays)
 *   4. During hold: original author can resume, story remains available.
 *   5. After hold: ACTIVE → PAUSED/ARCHIVED
 *   6. Archived stories must remain recoverable per Admin retention settings.
 */

import type { Story, PoolInactivityState } from "@/lib/storyverse/types";
import { store, generateId, addLedgerEntry } from "@/lib/storyverse/store";

/* ===================================================================
   INACTIVITY CHECK
   =================================================================== */

/**
 * Check if a Pool story is a candidate for inactivity hold.
 * A Pool story with only one contributor and no new joins triggers the hold timer.
 */
export function checkPoolInactivity(storyId: string): { eligible: boolean; reason?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { eligible: false, reason: "Story not found" };

  // Only pool stories
  if (!story.storyType.startsWith("pool")) {
    return { eligible: false, reason: "Not a pool story" };
  }

  // Must be ACTIVE
  if (story.status !== "ACTIVE") {
    return { eligible: false, reason: `Story is ${story.status}, not ACTIVE` };
  }

  // Only one contributor = candidate for inactivity
  if (story.contributors.length > 1) {
    return { eligible: false, reason: "Story has multiple contributors" };
  }

  return { eligible: true, reason: "Pool story with single contributor — inactivity hold candidate" };
}

/**
 * Start inactivity hold for a Pool story.
 * Story remains available but enters hold period.
 */
export function startInactivityHold(
  storyId: string,
  actorId: string,
): { ok: boolean; holdDays?: number; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };

  const check = checkPoolInactivity(storyId);
  if (!check.eligible) return { ok: false, error: check.reason };

  // Check if already in hold
  if (story.inactivityState?.status === "hold") {
    return { ok: false, error: "Story is already in hold" };
  }

  const holdDays = store.config.poolInactivityHoldDays;

  story.inactivityState = {
    status: "hold",
    holdStartedAt: new Date().toISOString(),
    lastActivityAt: story.updatedAt,
    holdReason: "Single contributor pool story — no new participants",
  };
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "pool_inactivity_hold",
    storyId,
    userId: actorId,
    metadata: {
      holdDays,
      holdStartedAt: story.inactivityState.holdStartedAt,
      contributorCount: story.contributors.length,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, holdDays };
}

/**
 * Archive a Pool story after hold period expires.
 * Must be called after the hold period (poolInactivityHoldDays) has elapsed.
 */
export function archiveForInactivity(
  storyId: string,
  actorId: string,
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };

  if (!story.inactivityState || story.inactivityState.status !== "hold") {
    return { ok: false, error: "Story is not in hold status" };
  }

  // Check if hold period has elapsed
  if (story.inactivityState.holdStartedAt) {
    const holdStart = new Date(story.inactivityState.holdStartedAt).getTime();
    const holdDays = store.config.poolInactivityHoldDays;
    const holdEnd = holdStart + holdDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (now < holdEnd) {
      const daysRemaining = Math.ceil((holdEnd - now) / (24 * 60 * 60 * 1000));
      return { ok: false, error: `Hold period has ${daysRemaining} day(s) remaining` };
    }
  }

  // Archive the story
  story.inactivityState.status = "archived";
  story.inactivityState.archivedAt = new Date().toISOString();
  story.status = "ARCHIVED";
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "pool_inactivity_archive",
    storyId,
    userId: actorId,
    metadata: {
      archivedAt: story.inactivityState.archivedAt,
      holdStartedAt: story.inactivityState.holdStartedAt,
      reason: "Inactivity hold period expired",
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

/**
 * Recover a Pool story from hold or archived status.
 * Original author can resume writing during hold.
 */
export function recoverFromInactivity(
  storyId: string,
  userId: string,
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };

  if (!story.inactivityState) {
    return { ok: false, error: "Story has no inactivity state" };
  }

  // Only the original owner can recover
  if (story.ownerId !== userId) {
    return { ok: false, error: "Only the story owner can recover from inactivity" };
  }

  // Can recover from hold or archived (within retention period)
  const currentState = story.inactivityState.status;
  if (currentState !== "hold" && currentState !== "archived") {
    return { ok: false, error: `Cannot recover from ${currentState} status` };
  }

  // If archived, check retention period
  if (currentState === "archived" && story.inactivityState.archivedAt) {
    const archiveTime = new Date(story.inactivityState.archivedAt).getTime();
    const retentionMs = store.config.retentionDays * 24 * 60 * 60 * 1000;
    if (Date.now() > archiveTime + retentionMs) {
      return { ok: false, error: "Story has exceeded the retention period and cannot be recovered" };
    }
  }

  story.inactivityState.status = "recovered";
  story.inactivityState.recoveredAt = new Date().toISOString();
  story.status = "ACTIVE";
  story.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "story_lifecycle",
    storyId,
    userId,
    metadata: {
      action: "recovered_from_inactivity",
      previousStatus: currentState,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

/**
 * Update last activity timestamp when a contribution is made or a user joins.
 */
export function updateInactivityActivity(storyId: string): void {
  const story = store.stories.get(storyId);
  if (!story?.inactivityState) return;

  // If story was in hold and activity occurs, reset the hold
  if (story.inactivityState.status === "hold" && story.contributors.length > 1) {
    story.inactivityState = undefined;
    story.updatedAt = new Date().toISOString();
  } else {
    story.inactivityState.lastActivityAt = new Date().toISOString();
  }
}

/**
 * Get stories currently in hold or archived due to inactivity.
 */
export function getInactivityStories(): Story[] {
  return [...store.stories.values()].filter(
    (s) => s.inactivityState && (s.inactivityState.status === "hold" || s.inactivityState.status === "archived"),
  );
}
