import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/storyverse/wallet — Get current user's wallet.
 */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();

  // Get or create wallet
  let { data: wallet } = await supabase
    .from("storyverse_wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    const { data: newWallet } = await supabase
      .from("storyverse_wallets")
      .upsert({
        user_id: user.id,
        total_earned: 0,
        pending_balance: 0,
        available_balance: 0,
        total_payouts: 0,
      }, { onConflict: "user_id" })
      .select()
      .single();
    wallet = newWallet;
  }

  // Get story earnings
  const { data: revenueEntries } = await supabase
    .from("storyverse_revenue")
    .select("story_id, revenue_type, gross_amount, distribution")
    .order("created_at", { ascending: false })
    .limit(50);

  const storyEarnings: Record<string, { storyId: string; earned: number; type: string }> = {};
  for (const entry of revenueEntries ?? []) {
    const dist = (entry.distribution as Array<{ userId: string; amount: number }>) ?? [];
    const userDist = dist.find((d) => d.userId === user.id);
    if (userDist) {
      if (!storyEarnings[entry.story_id]) {
        storyEarnings[entry.story_id] = { storyId: entry.story_id, earned: 0, type: entry.revenue_type };
      }
      storyEarnings[entry.story_id].earned += userDist.amount;
    }
  }

  // Get credit balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits, total_credits_used")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    wallet: wallet ?? { user_id: user.id, total_earned: 0, pending_balance: 0, available_balance: 0, total_payouts: 0 },
    storyEarnings: Object.values(storyEarnings),
    credits: {
      available: profile?.credits ?? 0,
      totalUsed: profile?.total_credits_used ?? 0,
    },
  });
}

/**
 * POST /api/storyverse/wallet — Request a payout.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { amount, method, accountIdentifier } = body;

  if (!amount || !method || !accountIdentifier) {
    return NextResponse.json({ error: "amount, method, and accountIdentifier are required" }, { status: 400 });
  }

  if (!["upi", "bank", "paypal"].includes(method)) {
    return NextResponse.json({ error: "method must be upi, bank, or paypal" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Check wallet balance
  const { data: wallet } = await supabase
    .from("storyverse_wallets")
    .select("available_balance")
    .eq("user_id", user.id)
    .single();

  if (!wallet || wallet.available_balance < amount) {
    return NextResponse.json({ error: "Insufficient available balance" }, { status: 400 });
  }

  // Check minimum payout
  const { data: minPayoutSetting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "storyverse_min_payout")
    .single();

  const minPayout = Number(minPayoutSetting?.value) || 10;
  if (amount < minPayout) {
    return NextResponse.json({ error: `Minimum payout is $${minPayout}` }, { status: 400 });
  }

  // Check for pending payouts
  const { data: pendingPayouts } = await supabase
    .from("storyverse_payouts")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .limit(1);

  if (pendingPayouts && pendingPayouts.length > 0) {
    return NextResponse.json({ error: "You already have a pending payout request" }, { status: 400 });
  }

  // Create payout request
  const { error: payoutError } = await supabase.from("storyverse_payouts").insert({
    user_id: user.id,
    amount,
    method,
    account_identifier: accountIdentifier,
    kyc_verified: true,
    security_cleared: true,
  });

  if (payoutError) {
    return NextResponse.json({ error: payoutError.message }, { status: 500 });
  }

  // Deduct from wallet
  await supabase
    .from("storyverse_wallets")
    .update({
      available_balance: wallet.available_balance - amount,
      pending_balance: (wallet.available_balance - amount + amount),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, message: "Payout request submitted" });
}
