import type {
  Story,
  RevenueEntry,
  RevenueDistribution,
  AuthorWallet,
  WalletTransaction,
  PayoutRequest,
  Purchase,
  LibraryEntry,
  MarketplaceListing,
} from "@/lib/storyverse/types";
import {
  store,
  generateId,
  addRevenueEntry,
  addLedgerEntry,
  addPurchase,
  addLibraryEntry,
  getWallet,
  getLibraryForUser,
} from "@/lib/storyverse/store";

/* ===================================================================
   BOOK SALE REVENUE (30% Platform / 70% Author Pool)
   =================================================================== */

export function processBookSale(
  storyId: string,
  buyerId: string,
  price: number,
  currency: string = "USD",
): { ok: boolean; purchase?: Purchase; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (!story.marketplace) return { ok: false, error: "Story is not listed in marketplace" };
  if (!story.publicationSnapshot) return { ok: false, error: "No publication snapshot found" };

  // Check if already purchased
  const existingPurchase = store.purchases.find(
    (p) => p.storyId === storyId && p.buyerId === buyerId,
  );
  if (existingPurchase) return { ok: false, error: "Already purchased" };

  // Create purchase
  const purchase: Purchase = {
    id: generateId("purchase"),
    storyId,
    buyerId,
    price,
    currency,
    purchasedAt: new Date().toISOString(),
  };
  addPurchase(purchase);

  // Calculate revenue split
  const platformAmount = price * (story.publicationSnapshot.platformRevenuePercent / 100);
  const authorPoolAmount = price * (story.publicationSnapshot.authorPoolRevenuePercent / 100);

  // Distribute to authors based on frozen snapshot
  const distribution: RevenueDistribution[] = story.publicationSnapshot.contributorShares.map((share) => ({
    userId: share.userId,
    displayName: share.displayName,
    sharePercent: share.sharePercent,
    amount: Math.round(authorPoolAmount * (share.sharePercent / 100) * 100) / 100,
  }));

  // Create revenue entry
  const revenueEntry: RevenueEntry = {
    id: generateId("rev"),
    storyId,
    revenueType: "book_sale",
    grossAmount: price,
    platformAmount,
    authorPoolAmount,
    distribution,
    currency,
    createdAt: new Date().toISOString(),
    ledgerEntryId: "", // will be set below
    immutable: true,
  };

  // Ledger entry
  const ledgerEntry = {
    id: generateId("ledger"),
    eventType: "book_sale" as const,
    storyId,
    userId: buyerId,
    metadata: {
      price,
      currency,
      platformAmount,
      authorPoolAmount,
      distribution: distribution.map((d) => ({ userId: d.userId, amount: d.amount })),
    },
    timestamp: new Date().toISOString(),
    immutable: true as const,
  };
  addLedgerEntry(ledgerEntry);
  revenueEntry.ledgerEntryId = ledgerEntry.id;

  addRevenueEntry(revenueEntry);

  // Update marketplace stats
  story.marketplace.totalSales++;
  story.marketplace.totalRevenue += price;

  // Credit author wallets
  for (const dist of distribution) {
    const wallet = getWallet(dist.userId);
    wallet.totalEarned += dist.amount;
    wallet.availableBalance += dist.amount;
    wallet.transactions.push({
      id: generateId("wallet-tx"),
      userId: dist.userId,
      type: "book_revenue",
      amount: dist.amount,
      currency,
      description: `Book sale revenue - ${story.title}`,
      storyId,
      createdAt: new Date().toISOString(),
    });
  }

  // Add to buyer's library
  const libraryEntry: LibraryEntry = {
    userId: buyerId,
    storyId,
    accessType: "purchased",
    addedAt: new Date().toISOString(),
  };
  addLibraryEntry(libraryEntry);

  // Ledger for revenue distribution
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "revenue_distribution",
    storyId,
    userId: buyerId,
    metadata: {
      purchaseId: purchase.id,
      totalDistributed: authorPoolAmount,
      distribution: distribution.map((d) => ({ userId: d.userId, amount: d.amount })),
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, purchase };
}

/* ===================================================================
   PAID VOTING TOKEN REVENUE (70% Platform / 30% Author Pool)
   =================================================================== */

export function processPaidVoteRevenue(
  storyId: string,
  voterId: string,
  tokenAmount: number,
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (!story.publicationSnapshot) return { ok: false, error: "No publication snapshot" };

  const grossRevenue = tokenAmount * store.config.paidVotePrice;
  const platformAmount = grossRevenue * (store.config.paidVotePlatformPercent / 100);
  const authorPoolAmount = grossRevenue * (store.config.paidVoteAuthorPoolPercent / 100);

  // Distribute to authors
  const distribution: RevenueDistribution[] = story.publicationSnapshot.contributorShares.map((share) => ({
    userId: share.userId,
    displayName: share.displayName,
    sharePercent: share.sharePercent,
    amount: Math.round(authorPoolAmount * (share.sharePercent / 100) * 100) / 100,
  }));

  const revenueEntry: RevenueEntry = {
    id: generateId("rev"),
    storyId,
    revenueType: "paid_vote_sale",
    grossAmount: grossRevenue,
    platformAmount,
    authorPoolAmount,
    distribution,
    currency: "USD",
    createdAt: new Date().toISOString(),
    ledgerEntryId: "",
    immutable: true,
  };

  const ledgerEntry = {
    id: generateId("ledger"),
    eventType: "paid_vote_sale" as const,
    storyId,
    userId: voterId,
    metadata: {
      tokensUsed: tokenAmount,
      grossRevenue,
      platformAmount,
      authorPoolAmount,
      split: `${store.config.paidVotePlatformPercent}/${store.config.paidVoteAuthorPoolPercent}`,
    },
    timestamp: new Date().toISOString(),
    immutable: true as const,
  };
  addLedgerEntry(ledgerEntry);
  revenueEntry.ledgerEntryId = ledgerEntry.id;

  addRevenueEntry(revenueEntry);

  // Credit author wallets
  for (const dist of distribution) {
    const wallet = getWallet(dist.userId);
    wallet.totalEarned += dist.amount;
    wallet.availableBalance += dist.amount;
    wallet.transactions.push({
      id: generateId("wallet-tx"),
      userId: dist.userId,
      type: "paid_vote_revenue",
      amount: dist.amount,
      currency: "USD",
      description: `Paid voting revenue - ${story.title}`,
      storyId,
      createdAt: new Date().toISOString(),
    });
  }

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "revenue_distribution",
    storyId,
    userId: voterId,
    metadata: {
      revenueType: "paid_vote_sale",
      totalDistributed: authorPoolAmount,
      distribution: distribution.map((d) => ({ userId: d.userId, amount: d.amount })),
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

/* ===================================================================
   WALLET & PAYOUT
   =================================================================== */

export function requestPayout(
  userId: string,
  amount: number,
  method: "upi" | "bank" | "paypal",
  accountIdentifier: string,
): { ok: boolean; payoutId?: string; error?: string } {
  const wallet = getWallet(userId);

  if (wallet.availableBalance < amount) {
    return { ok: false, error: "Insufficient available balance" };
  }
  if (amount < store.config.minimumPayoutThreshold) {
    return { ok: false, error: `Minimum payout threshold is $${store.config.minimumPayoutThreshold}` };
  }

  // Check for pending payout
  const pendingPayout = store.payoutRequests.find(
    (p) => p.userId === userId && (p.status === "pending" || p.status === "processing"),
  );
  if (pendingPayout) {
    return { ok: false, error: "You already have a pending payout request" };
  }

  // Check for suspension
  const isSuspended = store.abuseFlags.some(
    (f) => f.userId === userId && !f.resolved && f.flagType === "vote_manipulation",
  );
  if (isSuspended) {
    return { ok: false, error: "Account is suspended pending review" };
  }

  const payoutId = generateId("payout");
  const payout: PayoutRequest = {
    id: payoutId,
    userId,
    amount,
    currency: "USD",
    method,
    status: "pending",
    accountIdentifier,
    kycVerified: true, // blueprint: assumed verified
    securityCleared: true, // blueprint: assumed cleared
    createdAt: new Date().toISOString(),
    ledgerEntryId: "",
  };

  // Deduct from wallet
  wallet.availableBalance -= amount;
  wallet.pendingBalance += amount;

  // Wallet transaction
  wallet.transactions.push({
    id: generateId("wallet-tx"),
    userId,
    type: "payout",
    amount: -amount,
    currency: "USD",
    description: `Payout request via ${method}`,
    createdAt: new Date().toISOString(),
  });

  // Ledger
  const ledgerEntry = {
    id: generateId("ledger"),
    eventType: "payout_request" as const,
    storyId: "",
    userId,
    metadata: {
      payoutId,
      amount,
      method,
      accountIdentifier: accountIdentifier.replace(/(.{3}).*(.{3})/, "$1***$2"),
    },
    timestamp: new Date().toISOString(),
    immutable: true as const,
  };
  addLedgerEntry(ledgerEntry);
  payout.ledgerEntryId = ledgerEntry.id;

  store.payoutRequests.push(payout);

  return { ok: true, payoutId };
}

/* ===================================================================
   CO-AUTHOR FREE ACCESS
   =================================================================== */

export function grantCoAuthorAccess(storyId: string): void {
  const story = store.stories.get(storyId);
  if (!story) return;

  for (const contributor of story.contributors) {
    if (contributor.role === "owner" || contributor.role === "co_author") {
      const existing = getLibraryForUser(contributor.userId).find((l) => l.storyId === storyId);
      if (!existing) {
        addLibraryEntry({
          userId: contributor.userId,
          storyId,
          accessType: "co_author",
          addedAt: new Date().toISOString(),
        });
      }
    }
  }
}

/* ===================================================================
   MARKETPLACE LISTING
   =================================================================== */

export function listOnMarketplace(
  storyId: string,
  price: number,
  previewText: string,
): { ok: boolean; error?: string } {
  const story = store.stories.get(storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (story.status !== "PUBLISHED") return { ok: false, error: "Story must be published first" };

  story.marketplace = {
    storyId,
    price,
    currency: "USD",
    listedAt: new Date().toISOString(),
    totalSales: 0,
    totalRevenue: 0,
    previewText: previewText.slice(0, 500),
    previewWordCount: previewText.split(/\s+/).length,
  };
  story.status = "MARKETPLACE";
  story.updatedAt = new Date().toISOString();

  // Grant co-author free access
  grantCoAuthorAccess(storyId);

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "story_lifecycle",
    storyId,
    metadata: { action: "listed_on_marketplace", price },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}
