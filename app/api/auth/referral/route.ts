import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { applyReferralBonus } from "@/lib/growth/referral";

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
  return NextResponse.json(result, { status: result.credited ? 200 : 200 });
}
