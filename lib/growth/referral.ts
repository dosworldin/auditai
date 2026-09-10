const REFERRAL_STORAGE_KEY = "auditai_referral_code";

/** Client: remember a referral code from ?ref= for up to 30 days. */
export function captureReferralFromUrl(search: string) {
  const params = new URLSearchParams(search);
  const ref = params.get("ref");
  if (!ref || !/^[A-Za-z0-9]{3,12}$/.test(ref)) return;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toUpperCase());
    localStorage.setItem(`${REFERRAL_STORAGE_KEY}_at`, String(Date.now()));
  } catch {
    // storage unavailable — ignore
  }
}

/** Client: read + clear the stored referral code (used once at signup). */
export function consumeStoredReferral(): string | null {
  try {
    const code = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const at = Number(localStorage.getItem(`${REFERRAL_STORAGE_KEY}_at`) ?? 0);
    // Expire after 30 days
    if (!code || !at || Date.now() - at > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      localStorage.removeItem(`${REFERRAL_STORAGE_KEY}_at`);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export interface ReferralResult {
  credited: boolean;
  message?: string;
}

/**
 * Server-side (called from a route handler): find the referrer by code and
 * grant the bonus to both parties using the credit ledger. Best-effort —
 * never blocks signup. Amounts come from admin settings.
 */
export async function applyReferralBonus(
  supabase: any,
  newUserId: string,
  referralCode: string,
): Promise<ReferralResult> {
  try {
    // Settings
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["referral_enabled", "referral_bonus_credits"]);
    const map = new Map<string, unknown>((settings ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]));
    if (map.get("referral_enabled") === false) {
      return { credited: false, message: "Referral program disabled" };
    }
    const bonus = Number(map.get("referral_bonus_credits") ?? 50);
    if (!Number.isFinite(bonus) || bonus <= 0) {
      return { credited: false, message: "Invalid bonus amount" };
    }

    // Referrer lookup
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id, credits")
      .eq("referral_code", referralCode.toUpperCase())
      .single();
    if (!referrer || referrer.id === newUserId) {
      return { credited: false, message: "Referral code not found" };
    }

    const { data: newUser } = await supabase
      .from("profiles")
      .select("id, credits, referred_by")
      .eq("id", newUserId)
      .single();
    if (!newUser || newUser.referred_by) {
      return { credited: false, message: "Already referred" };
    }

    // Link + credit both
    const { error: linkErr } = await supabase
      .from("profiles")
      .update({ referred_by: referrer.id })
      .eq("id", newUserId);
    if (linkErr) return { credited: false, message: linkErr.message };

    const newBalance = Number(newUser.credits ?? 0) + bonus;
    const refBalance = Number(referrer.credits ?? 0) + bonus;

    const { error: newErr } = await supabase
      .from("profiles")
      .update({ credits: newBalance })
      .eq("id", newUserId);
    const { error: refErr } = await supabase
      .from("profiles")
      .update({ credits: refBalance })
      .eq("id", referrer.id);

    if (newErr || refErr) return { credited: false, message: "Credit update failed" };

    // Ledger entries (best-effort)
    await supabase.from("credit_ledger").insert([
      {
        user_id: newUserId,
        event_type: "signup_bonus",
        amount: bonus,
        balance_after: newBalance,
        description: `Referral bonus — invited by code ${referralCode.toUpperCase()}`,
        reference_type: "referral",
      },
      {
        user_id: referrer.id,
        event_type: "signup_bonus",
        amount: bonus,
        balance_after: refBalance,
        description: `Referral bonus — invited a new user (${referralCode.toUpperCase()})`,
        reference_type: "referral",
      },
    ]);

    return { credited: true };
  } catch (e) {
    return { credited: false, message: e instanceof Error ? e.message : "Referral failed" };
  }
}
