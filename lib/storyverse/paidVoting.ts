import type { VotingTokenPackage, VotingTokenBalance, VotingTokenTransaction } from "@/lib/storyverse/types";
import { store, generateId, addLedgerEntry } from "@/lib/storyverse/store";

/* ===================================================================
   PAID VOTING TOKENS

   100% Paid Voting Revenue → 70% Platform → 30% Author Pool

   "Paid voting helps support the platform and also contributes
   to the Author Pool."
   =================================================================== */

export const TOKEN_PACKAGES: VotingTokenPackage[] = [
  { id: "pkg-10", tokenCount: 10, price: 0.50, currency: "USD", label: "10 Tokens" },
  { id: "pkg-25", tokenCount: 25, price: 1.00, currency: "USD", label: "25 Tokens" },
  { id: "pkg-50", tokenCount: 50, price: 1.75, currency: "USD", label: "50 Tokens" },
  { id: "pkg-100", tokenCount: 100, price: 3.00, currency: "USD", label: "100 Tokens" },
];

export function purchaseTokens(
  userId: string,
  packageId: string,
): { ok: boolean; balance?: VotingTokenBalance; error?: string } {
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { ok: false, error: "Invalid package" };

  let balance = store.tokenBalances.get(userId);
  if (!balance) {
    balance = { userId, balance: 0, totalPurchased: 0, totalUsed: 0 };
    store.tokenBalances.set(userId, balance);
  }

  balance.balance += pkg.tokenCount;
  balance.totalPurchased += pkg.tokenCount;

  // Record transaction
  const tx: VotingTokenTransaction = {
    id: generateId("token-tx"),
    userId,
    type: "purchase",
    amount: pkg.tokenCount,
    balanceAfter: balance.balance,
    description: `Purchased ${pkg.tokenCount} voting tokens ($${pkg.price.toFixed(2)})`,
    createdAt: new Date().toISOString(),
  };
  store.tokenTransactions.push(tx);

  // Ledger entry
  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "paid_vote_sale",
    storyId: "",
    userId,
    metadata: {
      action: "token_purchase",
      packageId: pkg.id,
      tokenCount: pkg.tokenCount,
      price: pkg.price,
      currency: pkg.currency,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true, balance };
}

export function getTokenBalance(userId: string): VotingTokenBalance {
  let balance = store.tokenBalances.get(userId);
  if (!balance) {
    balance = { userId, balance: 0, totalPurchased: 0, totalUsed: 0 };
    store.tokenBalances.set(userId, balance);
  }
  return balance;
}

export function getTokenTransactions(userId: string): VotingTokenTransaction[] {
  return store.tokenTransactions.filter((tx) => tx.userId === userId);
}
