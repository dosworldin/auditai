import type { StoryInvitation, SoloInvitationPayment } from "@/lib/storyverse/types";
import {
  store,
  generateId,
  addLedgerEntry,
  getWallet,
  addSoloInvitationPayment,
} from "@/lib/storyverse/store";

/* ===================================================================
   PRIVATE STORY INVITATIONS
   =================================================================== */

export interface SendInvitationInput {
  storyId: string;
  inviterId: string;
  inviteeId: string;
}

export function sendInvitation(input: SendInvitationInput): { ok: boolean; invitationId?: string; error?: string } {
  const story = store.stories.get(input.storyId);
  if (!story) return { ok: false, error: "Story not found" };
  if (!story.inviteRequired) return { ok: false, error: "This story does not require invitations" };
  if (story.ownerId !== input.inviterId) {
    return { ok: false, error: "Only the story owner can send invitations" };
  }

  // Check if already a contributor
  const isContributor = story.contributors.some((c) => c.userId === input.inviteeId);
  if (isContributor) return { ok: false, error: "User is already a contributor" };

  // Check for pending invitation
  const existing = [...store.invitations.values()].find(
    (inv) => inv.storyId === input.storyId && inv.inviteeId === input.inviteeId && inv.status === "pending",
  );
  if (existing) return { ok: false, error: "Invitation already pending" };

  const invitationId = generateId("invite");
  const now = new Date().toISOString();

  const invitation: StoryInvitation = {
    id: invitationId,
    storyId: input.storyId,
    inviterId: input.inviterId,
    inviteeId: input.inviteeId,
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    createdAt: now,
    invitePrice: store.config.privateInvitePrice,
  };

  store.invitations.set(invitationId, invitation);

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "invitation_sent",
    storyId: input.storyId,
    userId: input.inviterId,
    metadata: {
      invitationId,
      inviteeId: input.inviteeId,
      invitePrice: invitation.invitePrice,
    },
    timestamp: now,
    immutable: true,
  });

  return { ok: true, invitationId };
}

/* ===================================================================
   PAID SOLO INVITATION ACCEPTANCE
   =================================================================== */

export function acceptInvitation(
  invitationId: string,
  userId: string,
  displayName: string,
  country?: string,
): { ok: boolean; paymentRequired?: boolean; paymentAmount?: number; error?: string } {
  const invitation = store.invitations.get(invitationId);
  if (!invitation) return { ok: false, error: "Invitation not found" };
  if (invitation.inviteeId !== userId) return { ok: false, error: "This invitation is not for you" };
  if (invitation.status !== "pending") return { ok: false, error: "Invitation is no longer pending" };
  if (new Date(invitation.expiresAt) < new Date()) {
    invitation.status = "expired";

    addLedgerEntry({
      id: generateId("ledger"),
      eventType: "invitation_expired",
      storyId: invitation.storyId,
      userId,
      metadata: { invitationId, expiredAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      immutable: true,
    });

    return { ok: false, error: "Invitation has expired" };
  }

  const story = store.stories.get(invitation.storyId);
  if (!story) return { ok: false, error: "Story not found" };

  // Check if private invite has a price (Solo stories or admin-configured)
  const invitePrice = invitation.invitePrice;
  const isSoloStory = story.storyType.startsWith("solo");

  if (invitePrice > 0) {
    // For Solo stories, the invitee pays the configured price
    // Check if already charged
    const existingPayment = [...store.soloInvitationPayments.values()].find(
      (p) => p.invitationId === invitationId && p.status === "charged",
    );

    if (!existingPayment) {
      // Deduct from invitee's wallet
      const wallet = getWallet(userId);
      const cost = invitePrice * store.config.creditValue;

      if (wallet.availableBalance < cost) {
        return {
          ok: false,
          paymentRequired: true,
          paymentAmount: cost,
          error: `Accepting this invitation costs $${cost.toFixed(2)} (${invitePrice} credits). Insufficient balance.`,
        };
      }

      // Charge the invitee
      wallet.availableBalance -= cost;
      wallet.transactions.push({
        id: generateId("wallet-tx"),
        userId,
        type: "token_purchase",
        amount: -cost,
        currency: "USD",
        description: `Private invitation accepted - ${story.title}`,
        storyId: invitation.storyId,
        createdAt: new Date().toISOString(),
      });

      // Record payment
      const paymentId = generateId("invite-payment");
      const payment: SoloInvitationPayment = {
        id: paymentId,
        invitationId,
        storyId: invitation.storyId,
        payerId: userId,
        payeeId: invitation.inviterId,
        amount: cost,
        currency: "USD",
        status: "charged",
        ledgerEntryId: "",
        createdAt: new Date().toISOString(),
        chargedAt: new Date().toISOString(),
      };

      const ledgerEntryId = generateId("ledger");
      payment.ledgerEntryId = ledgerEntryId;

      addSoloInvitationPayment(payment);

      // Ledger: invitation charged
      addLedgerEntry({
        id: ledgerEntryId,
        eventType: "invitation_charged",
        storyId: invitation.storyId,
        userId,
        metadata: {
          invitationId,
          paymentId,
          amount: cost,
          creditsCharged: invitePrice,
          payerId: userId,
          payeeId: invitation.inviterId,
        },
        timestamp: new Date().toISOString(),
        immutable: true,
      });
    }
  }

  // Accept the invitation
  invitation.status = "accepted";
  invitation.acceptedAt = new Date().toISOString();

  // Add as contributor
  story.contributors.push({
    userId,
    displayName,
    country,
    role: "contributor",
    joinedAt: new Date().toISOString(),
    totalContributions: 0,
    canonWins: 0,
    totalVotesReceived: 0,
    totalWordsAccepted: 0,
  });

  addLedgerEntry({
    id: generateId("ledger"),
    eventType: "invitation_accepted",
    storyId: invitation.storyId,
    userId,
    metadata: {
      invitationId,
      inviterId: invitation.inviterId,
      invitePrice,
      paidAmount: invitePrice > 0 ? invitePrice * store.config.creditValue : 0,
    },
    timestamp: new Date().toISOString(),
    immutable: true,
  });

  return { ok: true };
}

export function declineInvitation(invitationId: string, userId: string): { ok: boolean; error?: string } {
  const invitation = store.invitations.get(invitationId);
  if (!invitation) return { ok: false, error: "Invitation not found" };
  if (invitation.inviteeId !== userId) return { ok: false, error: "This invitation is not for you" };
  if (invitation.status !== "pending") return { ok: false, error: "Invitation is no longer pending" };

  invitation.status = "declined";
  return { ok: true };
}

export function getInvitationsForStory(storyId: string): StoryInvitation[] {
  return [...store.invitations.values()].filter((inv) => inv.storyId === storyId);
}

export function getInvitationsForUser(userId: string): StoryInvitation[] {
  return [...store.invitations.values()].filter((inv) => inv.inviteeId === userId);
}

/* ===================================================================
   CHECK INVITATION PRICE
   =================================================================== */

export function getInvitationPrice(): number {
  return store.config.privateInvitePrice;
}
