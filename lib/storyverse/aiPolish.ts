import type { AiPolishRequest } from "@/lib/storyverse/types";
import { store, generateId, addLedgerEntry } from "@/lib/storyverse/store";

/* ===================================================================
   AI POLISH

   Available only for Solo AI stories.
   AI must not silently replace ownership/contribution records.
   AI-generated content must remain distinguishable internally.
   =================================================================== */

export function requestAiPolish(
  storyId: string,
  contributionId: string,
  authorId: string,
): { ok: boolean; requestId?: string; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.storyType !== "solo_ai") {
    return { ok: false, error: "AI polish is only available for Solo AI stories" };
  }
  if (story.ownerId !== authorId) {
    return { ok: false, error: "Only the story owner can request AI polish" };
  }

  const contribution = store.contributions.get(contributionId);
  if (!contribution) return { ok: false, error: "Contribution not found" };
  if (contribution.authorId !== authorId) {
    return { ok: false, error: "Can only polish your own contributions" };
  }

  // Check credits
  const wallet = store.wallets.get(authorId);
  const availableCredits = wallet ? wallet.availableBalance / store.config.creditValue : 0;
  if (availableCredits < store.config.aiPolishPrice) {
    return { ok: false, error: `AI polish requires ${store.config.aiPolishPrice} credits` };
  }

  // Deduct credits
  if (wallet) {
    const creditCost = store.config.aiPolishPrice * store.config.creditValue;
    wallet.availableBalance -= creditCost;
    wallet.transactions.push({
      id: generateId("wallet-tx"),
      userId: authorId,
      type: "token_purchase",
      amount: -creditCost,
      currency: "USD",
      description: `AI polish for contribution`,
      storyId,
      createdAt: new Date().toISOString(),
    });
  }

  const requestId = generateId("ai-polish");
  const request: AiPolishRequest = {
    id: requestId,
    storyId,
    contributionId,
    authorId,
    originalContent: contribution.content,
    polishedContent: undefined,
    status: "requested",
    creditsCost: store.config.aiPolishPrice,
    createdAt: new Date().toISOString(),
  };

  store.aiPolishRequests.set(requestId, request);

  // Mark contribution
  contribution.aiPolishStatus = "requested";

  // Ledger
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "ai_polish_requested",
    storyId,
    contributionId,
    userId: authorId,
    metadata: {
      requestId,
      creditsCost: store.config.aiPolishPrice,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, requestId };
}

/**
 * Blueprint: Simulate AI polish completion.
 * In production, this would call an AI API and preserve the original content.
 */
export function completeAiPolish(
  requestId: string,
): { ok: boolean; error?: string } {
  const request = store.aiPolishRequests.get(requestId);
  if (!request) return { ok: false, error: "Request not found" };
  if (request.status !== "requested") return { ok: false, error: "Request is not in requested state" };

  const contribution = store.contributions.get(request.contributionId);
  if (!contribution) return { ok: false, error: "Contribution not found" };

  // Blueprint: simulate polished content (add "polished" prefix for audit trail)
  request.polishedContent = `[AI-Polished] ${request.originalContent}`;
  request.status = "completed";
  request.completedAt = new Date().toISOString();

  contribution.content = request.polishedContent;
  contribution.aiPolishStatus = "polished";
  contribution.updatedAt = new Date().toISOString();

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "ai_polish_completed",
    storyId: request.storyId,
    contributionId: request.contributionId,
    userId: request.authorId,
    metadata: {
      requestId,
      originalLength: request.originalContent.length,
      polishedLength: request.polishedContent.length,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}
