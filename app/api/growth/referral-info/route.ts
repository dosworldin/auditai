import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { resolveReferralCode } from "@/lib/growth/referral";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth/referral-info?code=XYZ
 * Public: validate a referral/invite code and return the reward amounts so the
 * signup page and share cards can show "You'll get X credits".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim();
  if (!code || !/^[A-Za-z0-9]{3,16}$/.test(code)) {
    return NextResponse.json({ valid: false, error: "Invalid code format" }, { status: 400 });
  }

  const supabase: any = await getSupabaseServer();
  const resolved = await resolveReferralCode(supabase, code);
  if (!resolved.ok) {
    return NextResponse.json({ valid: false, error: resolved.message });
  }

  return NextResponse.json({
    valid: true,
    kind: resolved.kind,
    bonus_credits: resolved.settings.viaLinkBonus,
  });
}
