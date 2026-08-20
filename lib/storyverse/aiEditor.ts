/**
 * AI Editor Module
 *
 * Runs AFTER a contribution wins voting in Pool stories.
 * Correct flow:
 *   Multiple Contributions → Voting → Winning Contribution → AI Editor
 *   → Continuity Check → Copyright Similarity/Risk Check
 *   → Author Review if required → Canonization
 *
 * AI Editor is a separately chargeable StoryVerse feature.
 * Uses existing credit/billing infrastructure.
 */

import type {
  AiEditorRequest,
  AiContinuityResult,
  CopyrightAnalysis,
  CopyrightRiskLevel,
  Contribution,
  Story,
} from "@/lib/storyverse/types";
import {
  store,
  generateId,
  addLedgerEntry,
  getWallet,
  addAiEditorRequest,
  addCopyrightAnalysis,
} from "@/lib/storyverse/store";

/* ===================================================================
   AI EDITOR — ENTRY POINT
   =================================================================== */

export interface RunAiEditorInput {
  storyId: string;
  /** The winning contribution ID after canon selection */
  contributionId: string;
  roundId: string;
  /** Author of the winning contribution */
  authorId: string;
}

export interface AiEditorResult {
  ok: boolean;
  requestId?: string;
  continuityResult?: AiContinuityResult;
  copyrightResult?: CopyrightAnalysis;
  suggestedRewrite?: string;
  /** If true, author must approve before canonization */
  requiresAuthorApproval: boolean;
  error?: string;
}

/**
 * Execute AI Editor on a post-voting winning contribution.
 * Charges credits, runs continuity + copyright checks.
 */
export function runAiEditor(input: RunAiEditorInput): AiEditorResult {
  const story = store.stories.get(input.storyId);
  if (!story) return { ok: false, error: "Story not found", requiresAuthorApproval: false };

  // Only Pool stories get AI Editor on winning contributions
  if (!story.storyType.startsWith("pool")) {
    return { ok: false, error: "AI Editor is available for Pool stories", requiresAuthorApproval: false };
  }

  if (!store.config.aiEditorEnabled) {
    return { ok: false, error: "AI Editor is currently disabled", requiresAuthorApproval: false };
  }

  const contribution = store.contributions.get(input.contributionId);
  if (!contribution) return { ok: false, error: "Contribution not found", requiresAuthorApproval: false };
  if (contribution.authorId !== input.authorId) {
    return { ok: false, error: "Can only run AI Editor on your own contribution", requiresAuthorApproval: false };
  }

  // Check credits
  const wallet = getWallet(input.authorId);
  const creditCost = store.config.aiEditorPrice * store.config.creditValue;
  if (wallet.availableBalance < creditCost) {
    return {
      ok: false,
      error: `AI Editor requires ${store.config.aiEditorPrice} credits ($${creditCost.toFixed(2)}). Current balance: $${wallet.availableBalance.toFixed(2)}`,
      requiresAuthorApproval: false,
    };
  }

  // Deduct credits atomically
  wallet.availableBalance -= creditCost;
  wallet.transactions.push({
    id: generateId("wallet-tx"),
    userId: input.authorId,
    type: "token_purchase",
    amount: -creditCost,
    currency: "USD",
    description: `AI Editor execution - ${story.title}`,
    storyId: input.storyId,
    createdAt: new Date().toISOString(),
  });

  // Create request
  const requestId = generateId("ai-editor");
  const request: AiEditorRequest = {
    id: requestId,
    storyId: input.storyId,
    contributionId: input.contributionId,
    roundId: input.roundId,
    authorId: input.authorId,
    originalContent: contribution.content,
    status: "running",
    creditsCost: store.config.aiEditorPrice,
    createdAt: new Date().toISOString(),
  };

  // Run continuity check
  const continuityResult = store.config.aiEditorContinuityEnabled
    ? runContinuityCheck(story, contribution)
    : { passed: true, grammarOk: true, characterConsistency: true, timelineConsistency: true, locationConsistency: true, canonContinuity: true, contradictions: [], suggestions: [], materialRevisionProposed: false };

  request.continuityResult = continuityResult;

  // Run copyright check
  let copyrightResult: CopyrightAnalysis | undefined;
  if (store.config.aiEditorCopyrightCheckEnabled) {
    copyrightResult = runCopyrightCheck(input.storyId, input.contributionId, contribution.content);
    request.copyrightResult = copyrightResult;
  }

  // Determine if rewrite is needed
  const needsRewrite = continuityResult.materialRevisionProposed ||
    (copyrightResult && copyrightResult.riskLevel !== "CLEAR");

  let suggestedRewrite: string | undefined;
  let requiresAuthorApproval = false;

  if (needsRewrite && store.config.aiRewriteEnabled) {
    // Blueprint: simulate a substantially original rewrite
    suggestedRewrite = generateRewriteSimulation(contribution.content, continuityResult, copyrightResult);
    request.suggestedRewrite = suggestedRewrite;
    requiresAuthorApproval = true;
    request.status = "rewrite_pending";
  } else if (!continuityResult.passed) {
    request.status = "continuity_failed";
  } else if (copyrightResult && copyrightResult.riskLevel === "HIGH_SIMILARITY_REVIEW") {
    request.status = "copyright_high_review";
    requiresAuthorApproval = true;
  } else {
    request.status = "completed";
  }

  request.completedAt = new Date().toISOString();
  addAiEditorRequest(request);

  // Ledger: charge
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "ai_editor_charged",
    storyId: input.storyId,
    contributionId: input.contributionId,
    userId: input.authorId,
    metadata: {
      requestId,
      creditsCost: store.config.aiEditorPrice,
      dollarCost: creditCost,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  // Ledger: execution
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "ai_editor_executed",
    storyId: input.storyId,
    contributionId: input.contributionId,
    userId: input.authorId,
    metadata: {
      requestId,
      continuityPassed: continuityResult.passed,
      copyrightRiskLevel: copyrightResult?.riskLevel ?? "not_checked",
      materialRevisionProposed: continuityResult.materialRevisionProposed,
      requiresAuthorApproval,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  // Ledger: continuity check
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "ai_editor_continuity_check",
    storyId: input.storyId,
    contributionId: input.contributionId,
    userId: input.authorId,
    metadata: {
      requestId,
      passed: continuityResult.passed,
      grammarOk: continuityResult.grammarOk,
      characterConsistency: continuityResult.characterConsistency,
      timelineConsistency: continuityResult.timelineConsistency,
      locationConsistency: continuityResult.locationConsistency,
      canonContinuity: continuityResult.canonContinuity,
      contradictions: continuityResult.contradictions,
      materialRevisionProposed: continuityResult.materialRevisionProposed,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  // Ledger: copyright check
  if (copyrightResult) {
    addLedgerEntry({
      id: generateId("ledger"),
      eventType: "ai_editor_copyright_check",
      storyId: input.storyId,
      contributionId: input.contributionId,
      userId: input.authorId,
      metadata: {
        requestId,
        analysisId: copyrightResult.id,
        similarityScore: copyrightResult.similarityScore,
        riskLevel: copyrightResult.riskLevel,
        matchingSegmentsCount: copyrightResult.matchingSegments.length,
      },
      timestamp: new Date().toISOString(),
      immutable: true,
    });
  }

  return {
    ok: true,
    requestId,
    continuityResult,
    copyrightResult,
    suggestedRewrite,
    requiresAuthorApproval,
  };
}

/* ===================================================================
   AUTHOR APPROVAL / REJECTION
   =================================================================== */

export interface ApproveRewriteInput {
  storyId: string;
  requestId: string;
  userId: string;
  /** true = approve rewrite, false = reject rewrite and keep original */
  approved: boolean;
}

export function respondToAiEditorRewrite(input: ApproveRewriteInput): { ok: boolean; finalContent?: string; error?: string } {
  const request = store.aiEditorRequests.get(input.requestId);
  if (!request) return { ok: false, error: "AI Editor request not found" };
  if (request.storyId !== input.storyId) return { ok: false, error: "Story mismatch" };
  if (request.authorId !== input.userId) return { ok: false, error: "Only the author can approve/reject" };
  if (request.status !== "rewrite_pending") return { ok: false, error: "No pending rewrite" };

  if (input.approved) {
    // Author approves the AI rewrite
    request.approvedContent = request.suggestedRewrite;
    request.status = "rewrite_approved";
    request.completedAt = new Date().toISOString();

    // Update contribution with approved content
    const contribution = store.contributions.get(request.contributionId);
    if (contribution && request.approvedContent) {
      contribution.content = request.approvedContent;
      contribution.updatedAt = new Date().toISOString();
    }

    addLedgerEntry({
      id: generateId("ledger"),
      eventType: "ai_editor_rewrite_approved",
      storyId: input.storyId,
      contributionId: request.contributionId,
      userId: input.userId,
      metadata: { requestId: input.requestId, contentLength: request.approvedContent?.length ?? 0 },
      timestamp: new Date().toISOString(),
      immutable: true,
    });

    return { ok: true, finalContent: request.approvedContent };
  } else {
    // Author rejects rewrite, keeps original
    request.approvedContent = request.originalContent;
    request.status = "rewrite_rejected";
    request.completedAt = new Date().toISOString();

    addLedgerEntry({
      id: generateId("ledger"),
      eventType: "ai_editor_rewrite_rejected",
      storyId: input.storyId,
      contributionId: request.contributionId,
      userId: input.userId,
      metadata: { requestId: input.requestId, keptOriginal: true },
      timestamp: new Date().toISOString(),
      immutable: true,
    });

    return { ok: true, finalContent: request.originalContent };
  }
}

/* ===================================================================
   CONTINUITY CHECK (Blueprint simulation)
   =================================================================== */

function runContinuityCheck(story: Story, contribution: Contribution): AiContinuityResult {
  // Blueprint: simulate continuity analysis
  const canonContent = story.chapters.map((ch) => ch.content).join(" ");
  const contribWords = new Set(contribution.content.toLowerCase().split(/\s+/));
  const canonWords = new Set(canonContent.toLowerCase().split(/\s+/));

  // Check for word overlap (basic continuity signal)
  const overlap = [...contribWords].filter((w) => canonWords.has(w)).length;
  const overlapRatio = contribWords.size > 0 ? overlap / contribWords.size : 0;

  const hasContradictions = overlapRatio < 0.1 && contribution.wordCount > 50;
  const materialRevision = hasContradictions;

  return {
    passed: !materialRevision,
    grammarOk: true, // Blueprint: assumed ok
    characterConsistency: overlapRatio >= 0.1,
    timelineConsistency: true,
    locationConsistency: true,
    canonContinuity: overlapRatio >= 0.1,
    contradictions: hasContradictions ? ["Contribution has low overlap with existing canon content"] : [],
    suggestions: materialRevision ? ["Consider adding more references to established canon elements"] : [],
    materialRevisionProposed: materialRevision,
  };
}

/* ===================================================================
   COPYRIGHT SIMILARITY CHECK (Blueprint simulation)
   =================================================================== */

function runCopyrightCheck(storyId: string, contributionId: string, content: string): CopyrightAnalysis {
  const words = content.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  // Blueprint: simulate similarity based on common word patterns
  // In production, this would compare against a reference database
  const commonPatterns = /\b(the|and|was|for|that|with|this|have|from|they|been|said|each|which|their|time|will|way|about|many|then|them|wrote|story|character|chapter|said|told|came|went|looked)\b/gi;
  const commonMatches = content.match(commonPatterns) ?? [];
  const commonRatio = wordCount > 0 ? commonMatches.length / wordCount : 0;

  // Simulate a similarity score
  let similarityScore: number;
  if (commonRatio > 0.5) {
    similarityScore = 20 + Math.floor(Math.random() * 30); // 20-50
  } else if (commonRatio > 0.3) {
    similarityScore = 10 + Math.floor(Math.random() * 25); // 10-35
  } else {
    similarityScore = Math.floor(Math.random() * 20); // 0-20
  }

  const warningThreshold = store.config.copyrightSimilarityWarningThreshold;
  const highThreshold = store.config.copyrightHighSimilarityThreshold;

  let riskLevel: CopyrightRiskLevel;
  if (similarityScore >= highThreshold) {
    riskLevel = "HIGH_SIMILARITY_REVIEW";
  } else if (similarityScore >= warningThreshold) {
    riskLevel = "SIMILARITY_WARNING";
  } else {
    riskLevel = "CLEAR";
  }

  const matchingSegments: { text: string; similarityPercent: number; source: string }[] = [];
  if (similarityScore >= warningThreshold) {
    // Show a simulated matching segment
    matchingSegments.push({
      text: commonMatches.slice(0, 3).join(" ") || "...",
      similarityPercent: similarityScore,
      source: "AI similarity analysis (reference database)",
    });
  }

  const analysis: CopyrightAnalysis = {
    id: generateId("copyright"),
    storyId,
    contributionId,
    similarityScore,
    riskLevel,
    disclaimer: "This is an AI-generated similarity/risk signal, NOT a legal copyright determination. Consult legal counsel for definitive copyright assessment.",
    matchingSegments,
    originalContent: content,
    authorApproved: false,
    createdAt: new Date().toISOString(),
  };

  addCopyrightAnalysis(analysis);
  return analysis;
}

/* ===================================================================
   REWRITE SIMULATION (Blueprint)
   =================================================================== */

function generateRewriteSimulation(
  original: string,
  continuityResult: AiContinuityResult,
  copyrightResult?: CopyrightAnalysis,
): string {
  // Blueprint: add a prefix indicating AI rewrite, preserve original structure
  const issues: string[] = [];
  if (!continuityResult.passed) {
    issues.push("continuity adjustments");
  }
  if (copyrightResult && copyrightResult.riskLevel !== "CLEAR") {
    issues.push("originality improvements");
  }

  // In production, this would call an AI API
  // Blueprint: return a clearly marked rewrite suggestion
  return `[AI-Suggested Revision — ${issues.join(", ")}]\n\n${original}`;
}
