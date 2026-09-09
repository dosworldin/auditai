import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/db/supabase-server";
import { sendPayoutStatusEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payouts — list StoryVerse payout requests (admin only).
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("storyverse_payouts")
    .select("*, profiles!storyverse_payouts_user_id_fkey(email, display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // Fallback: join name may differ; list without profile columns
    const { data: plain } = await supabase
      .from("storyverse_payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ payouts: plain ?? [], warning: error.message });
  }

  return NextResponse.json({ payouts: data ?? [] });
}

/**
 * PATCH /api/admin/payouts — approve / reject / mark paid (admin only).
 * Rejection refunds the amount to the author's StoryVerse wallet.
 * Status transitions: pending|processing -> approved|rejected; approved -> paid.
 */
export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const payoutId = typeof b.payout_id === "string" ? b.payout_id : "";
  const action = typeof b.action === "string" ? b.action : "";
  const reason = typeof b.reason === "string" ? b.reason : undefined;

  if (!payoutId || !["approve", "reject", "mark_paid"].includes(action)) {
    return NextResponse.json({ error: "payout_id and action (approve|reject|mark_paid) are required" }, { status: 400 });
  }

  const serverSupabase = await getSupabaseServer();
  const { data: payout } = await serverSupabase
    .from("storyverse_payouts")
    .select("*")
    .eq("id", payoutId)
    .single();

  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

  const supabase = await getSupabaseAdmin();

  // Email the author (best-effort)
  const notify = async (status: "approved" | "rejected" | "paid") => {
    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("email")
      .eq("id", payout.user_id)
      .single();
    if (profile?.email) {
      await sendPayoutStatusEmail({
        to: profile.email,
        status,
        amount: Number(payout.amount),
        reason,
      });
    }
  };

  if (action === "approve") {
    if (payout.status !== "pending" && payout.status !== "processing") {
      return NextResponse.json({ error: `Cannot approve a payout in status "${payout.status}"` }, { status: 400 });
    }
    const { error } = await supabase
      .from("storyverse_payouts")
      .update({ status: "approved", processed_at: new Date().toISOString() })
      .eq("id", payoutId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await notify("approved");
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "reject") {
    if (payout.status === "rejected" || payout.status === "paid") {
      return NextResponse.json({ error: `Cannot reject a payout in status "${payout.status}"` }, { status: 400 });
    }
    const { error } = await supabase
      .from("storyverse_payouts")
      .update({ status: "rejected", rejection_reason: reason ?? "Rejected by admin", processed_at: new Date().toISOString() })
      .eq("id", payoutId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Refund to StoryVerse wallet
    const { data: wallet } = await serverSupabase
      .from("storyverse_wallets")
      .select("available_balance, pending_balance")
      .eq("user_id", payout.user_id)
      .single();
    if (wallet) {
      await supabase
        .from("storyverse_wallets")
        .update({
          available_balance: Number(wallet.available_balance) + Number(payout.amount),
          pending_balance: Math.max(0, Number(wallet.pending_balance) - Number(payout.amount)),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", payout.user_id);
    }
    await notify("rejected");
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // mark_paid
  if (payout.status !== "approved") {
    return NextResponse.json({ error: "Only approved payouts can be marked as paid" }, { status: 400 });
  }
  const { error } = await supabase
    .from("storyverse_payouts")
    .update({
      status: "paid",
      processed_at: new Date().toISOString(),
    })
    .eq("id", payoutId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Move pending -> total_payouts
  const { data: wallet } = await serverSupabase
    .from("storyverse_wallets")
    .select("pending_balance, total_payouts")
    .eq("user_id", payout.user_id)
    .single();
  if (wallet) {
    await supabase
      .from("storyverse_wallets")
      .update({
        pending_balance: Math.max(0, Number(wallet.pending_balance) - Number(payout.amount)),
        total_payouts: Number(wallet.total_payouts) + Number(payout.amount),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payout.user_id);
  }
  await notify("paid");
  return NextResponse.json({ ok: true, status: "paid", by: admin.email });
}
