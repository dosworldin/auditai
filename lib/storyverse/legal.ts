/**
 * StoryVerse Legal Module
 *
 * 1. Contributor Agreement — every contributor must accept before first contribution.
 * 2. Exclusive StoryVerse Publishing — governed by the accepted Contributor Agreement.
 *
 * Uses the existing Legal Ledger (append-only ledger entries).
 * No second legal acceptance system is created.
 */

import type {
  ContributorAgreement,
  ExclusivePublishingException,
} from "@/lib/storyverse/types";
import {
  store,
  generateId,
  addLedgerEntry,
  addContributorAgreement,
  hasAcceptedAgreement,
} from "@/lib/storyverse/store";

/* ===================================================================
   CONTRIBUTOR AGREEMENT VERSION
   =================================================================== */

/**
 * Current active agreement version.
 * In production, this would be a versioned document stored in the database.
 * Changes to this version do NOT retroactively alter previously accepted agreements.
 */
export const CURRENT_AGREEMENT_VERSION = "1.0.0";

/**
 * Full agreement text hash (for integrity verification).
 * In production, this would be a SHA-256 of the actual agreement document.
 */
export const AGREEMENT_TEXT_HASH = "sha256:storyverse-contributor-agreement-v1.0.0";

/**
 * Agreement summary — covers all required rights:
 * - Publishing
 * - Digital distribution
 * - Commercial sale
 * - Editing/polishing
 * - Compilation of contributions
 * - Marketing/promotion
 * - Applicable licensing/distribution rights
 * - Contributor attribution
 * - Contributor revenue share
 * - Restrictions on independent publication/distribution
 */
export const AGREEMENT_SUMMARY = {
  publishing: "The platform may publish the collective work in all formats.",
  digitalDistribution: "The platform may distribute the work digitally across all channels.",
  commercialSale: "The platform may sell the work commercially and manage all revenue.",
  editing: "The platform may edit, polish, and compile contributions for publication.",
  marketing: "The platform may market and promote the work.",
  licensing: "The platform may license the work under applicable distribution rights.",
  attribution: "Contributors receive attribution per the frozen publication snapshot.",
  revenueShare: "Revenue is distributed per the immutable publication snapshot shares.",
  exclusivity: "Contributors may not independently publish, sell, license, or distribute the StoryVerse collective work while exclusivity is active.",
};

/* ===================================================================
   ACCEPT CONTRIBUTOR AGREEMENT
   =================================================================== */

export interface AcceptAgreementInput {
  userId: string;
  /** Optional: the story they are contributing to (for ledger reference) */
  storyId?: string;
}

/**
 * Record that a user accepted the current Contributor Agreement.
 * Must be called before their first contribution to any StoryVerse story.
 * The agreement is recorded once per user and is immutable.
 */
export function acceptContributorAgreement(
  input: AcceptAgreementInput,
): { ok: boolean; agreementId?: string; error?: string } {
  // Check if already accepted
  if (hasAcceptedAgreement(input.userId)) {
    const existing = [...store.contributorAgreements.values()].find(
      (a) => a.userId === input.userId && a.accepted,
    );
    if (existing && existing.agreementVersion === CURRENT_AGREEMENT_VERSION) {
      return { ok: true, agreementId: existing.id }; // Already accepted current version
    }
    // Different version accepted — record new acceptance (never replace old)
  }

  const agreementId = generateId("agreement");
  const agreement: ContributorAgreement = {
    id: agreementId,
    userId: input.userId,
    agreementVersion: CURRENT_AGREEMENT_VERSION,
    agreementTextHash: AGREEMENT_TEXT_HASH,
    acceptedAt: new Date().toISOString(),
    accepted: true,
  };

  addContributorAgreement(agreement);

  // Ledger entry
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "contributor_agreement_accepted",
    storyId: input.storyId ?? "",
    userId: input.userId,
    metadata: {
      agreementId,
      agreementVersion: CURRENT_AGREEMENT_VERSION,
      agreementTextHash: AGREEMENT_TEXT_HASH,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, agreementId };
}

/**
 * Check if a user has accepted the current Contributor Agreement.
 */
export function hasCurrentAgreement(userId: string): boolean {
  return [...store.contributorAgreements.values()].some(
    (a) =>
      a.userId === userId &&
      a.accepted &&
      a.agreementVersion === CURRENT_AGREEMENT_VERSION,
  );
}

/**
 * Get a user's agreement record.
 */
export function getUserAgreement(userId: string): ContributorAgreement | undefined {
  return [...store.contributorAgreements.values()].find(
    (a) => a.userId === userId && a.accepted,
  );
}

/**
 * Get all agreements for auditing purposes.
 */
export function getAllAgreements(): ContributorAgreement[] {
  return [...store.contributorAgreements.values()];
}

/* ===================================================================
   EXCLUSIVE STORYVERSE PUBLISHING
   =================================================================== */

/**
 * Check if a contributor is bound by exclusive publishing rights.
 * Returns true if the user has accepted the current agreement and
 * no admin-approved exception/release exists.
 */
export function isBoundByExclusivity(userId: string): boolean {
  if (!hasCurrentAgreement(userId)) return false;

  // Check for any admin-approved exceptions
  const exceptions = store.ledger.filter(
    (e) =>
      e.eventType === "exclusivity_exception" &&
      e.userId === userId &&
      e.metadata.resolved === true,
  );

  return exceptions.length === 0;
}

/**
 * Record an admin-approved exception to exclusive publishing rights.
 * Must be explicitly recorded in the Legal Ledger.
 */
export function grantExclusivityException(
  userId: string,
  storyId: string,
  grantedBy: string,
  reason: string,
): { ok: boolean; exceptionId?: string; error?: string } {
  if (!hasAcceptedAgreement(userId)) {
    return { ok: false, error: "User has not accepted the Contributor Agreement" };
  }

  const exceptionId = generateId("exception");
  const ledgerEntryId = generateId("ledger");

  addLedgerEntry({
    id: ledgerEntryId,
    eventType: "exclusivity_exception",
    storyId,
    userId,
    metadata: {
      exceptionId,
      grantedBy,
      reason,
      resolved: true,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, exceptionId };
}

/**
 * Validate that a contribution can proceed.
 * Every contributor must have accepted the agreement before their first contribution.
 */
export function validateContributionEligibility(
  userId: string,
  storyId: string,
): { eligible: boolean; error?: string } {
  if (!hasCurrentAgreement(userId)) {
    return {
      eligible: false,
      error: "You must accept the StoryVerse Contributor Agreement before making your first contribution. The agreement covers publishing rights, digital distribution, commercial sale, editing, marketing, licensing, attribution, revenue share, and exclusivity terms.",
    };
  }

  return { eligible: true };
}
