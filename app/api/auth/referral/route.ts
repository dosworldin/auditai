import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { applyReferralBonus } from "@/lib/growth/referral";
import { notifyAdmin } from "@/lib/admin/notify";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/referral — apply a referral code for the signed-in new user.
 * Body: { code: string }. Best-effort: returns { credited: boolean }.
 */
export async function POST(request: Request) {
  const supabase: any = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || !/^[A-Za-z0-9]{3,12}$/.test(code)) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
  }

  const result = await applyReferralBonus(supabase, user.id, code);

  // Admin live-activity notification (best-effort). Done here rather than
  // inside lib/growth/referral.ts, which is also imported by client code.
  if (result.credited) {
    notifyAdmin({
      type: "referral_join",
      summary: `Referral join: ${user.email ?? user.id} used code ${code.toUpperCase()} — bonus credits applied`,
      detail: { code: code.toUpperCase(), new_user_id: user.id },
    });
  }

  return NextResponse.json(result, { status: result.credited ? 200 : 200 });
}
