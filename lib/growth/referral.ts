const REFERRAL_STORAGE_KEY = "auditai_referral_code";

/** Accept both personal referral codes (R-XXXXXX) and admin invite codes. */
const CODE_PATTERN = /^[A-Za-z0-9]{3,16}$/;

/** Client: remember a referral/invite code from ?ref= or ?invite= for up to 30 days. */
export function captureReferralFromUrl(search: string) {
  const params = new URLSearchParams(search);
  const raw = params.get("ref") ?? params.get("invite") ?? params.get("invite_code");
  if (!raw || !CODE_PATTERN.test(raw)) return;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, raw.toUpperCase());
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

export interface ReferralSettings {
  enabled: boolean;
  /** Extra credits for the NEW user when joining via a shared link/coupon. */
  viaLinkBonus: number;
  /** Credits the inviter earns when someone joins via their link/coupon. */
  inviterBonus: number;
}

/** Read the growth settings via the service-role client. */
async function readSettings(supabase: any): Promise<ReferralSettings> {
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", ["referral_enabled", "referral_bonus_credits", "referral_inviter_bonus_credits"]);
  const map = new Map<string, unknown>(
    (settings ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );
  return {
    enabled: map.get("referral_enabled") !== false && String(map.get("referral_enabled")) !== "false",
    viaLinkBonus: Number(map.get("referral_bonus_credits") ?? 100),
    inviterBonus: Number(map.get("referral_inviter_bonus_credits") ?? 100),
  };
}

/**
 * Server-side (route handler): resolve a referral/invite code and return the
 * reward plan. Handles:
 *  - personal referral codes from profiles.referral_code
 *  - admin invite codes (type=invite, has an owner who earns the inviter bonus)
 *  - admin open coupons (type=open, only the new user earns the bonus)
 */
export async function resolveReferralCode(
  supabase: any,
  code: string,
): Promise<
  | { ok: true; kind: "profile" | "invite" | "open"; ownerId: string | null; settings: ReferralSettings }
  | { ok: false; message: string }
> {
  const settings = await readSettings(supabase);
  if (!settings.enabled) return { ok: false, message: "Referral program disabled" };
  if (!Number.isFinite(settings.viaLinkBonus) || settings.viaLinkBonus <= 0) {
    return { ok: false, message: "Invalid bonus amount" };
  }

  const upper = code.toUpperCase();

  // 1. Personal referral code (profiles table) — inviter = profile owner
  const { data: profileRef } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", upper)
    .maybeSingle();
  if (profileRef) {
    return { ok: true, kind: "profile", ownerId: profileRef.id, settings };
  }

  // 2. Admin invite/coupon code
  const { data: invite } = await supabase
    .from("invite_codes")
    .select("code, type, created_by, max_uses, uses, is_active")
    .eq("code", upper)
    .maybeSingle();
  if (invite) {
    if (!invite.is_active) return { ok: false, message: "This invite code is no longer active" };
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
      return { ok: false, message: "This invite code has reached its usage limit" };
    }
    return {
      ok: true,
      kind: invite.type === "open" ? "open" : "invite",
      ownerId: invite.type === "open" ? null : invite.created_by,
      settings,
    };
  }

  return { ok: false, message: "Referral code not found" };
}

/** Credit helper: bump balance + write a ledger row (best-effort ledger). */
async function grantCredits(
  supabase: any,
  userId: string,
  amount: number,
  description: string,
  referenceType: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  if (!profile) return false;

  const newBalance = Math.round((Number(profile.credits ?? 0) + amount) * 100) / 100;
  const { error } = await supabase
    .from("profiles")
    .update({ credits: newBalance })
    .eq("id", userId);
  if (error) return false;

  await supabase.from("credit_ledger").insert({
    user_id: userId,
    event_type: "referral_bonus",
    amount,
    balance_after: newBalance,
    description,
    reference_type: referenceType,
  });
  return true;
}

/**
 * Apply a referral/invite code for a just-signed-up user.
 *  - New user gets the via-link bonus (sharing → jyada credits).
 *  - Inviter gets their bonus (personal code or admin invite code).
 *  - Open coupons reward only the new user.
 * Records `referred_by` on the new profile and increments invite usage.
 */
export async function applyReferralBonus(
  supabase: any,
  newUserId: string,
  referralCode: string,
): Promise<ReferralResult> {
  try {
    const resolved = await resolveReferralCode(supabase, referralCode);
    if (!resolved.ok) return { credited: false, message: resolved.message };

    const { data: newUser } = await supabase
      .from("profiles")
      .select("id, referred_by")
      .eq("id", newUserId)
      .single();
    if (!newUser) return { credited: false, message: "Profile not found" };
    if (newUser.referred_by) return { credited: false, message: "Already referred" };

    // Self-referral guard (inviter cannot be the new user themselves)
    if (resolved.ownerId && resolved.ownerId === newUserId) {
      return { credited: false, message: "Cannot use your own code" };
    }

    // Link the accounts first (one-time).
    const { error: linkErr } = await supabase
      .from("profiles")
      .update({ referred_by: resolved.ownerId })
      .eq("id", newUserId);
    if (linkErr) return { credited: false, message: linkErr.message };

    const upper = referralCode.toUpperCase();

    // New user always gets the via-link bonus when the code is valid.
    const newUserOk = await grantCredits(
      supabase,
      newUserId,
      resolved.settings.viaLinkBonus,
      `Referral bonus — joined via ${upper}`,
      "referral",
    );
    if (!newUserOk) return { credited: false, message: "Credit update failed" };

    // Inviter bonus for personal codes and admin invite codes.
    if (resolved.ownerId) {
      await grantCredits(
        supabase,
        resolved.ownerId,
        resolved.settings.inviterBonus,
        `Referral reward — a new user joined via ${upper}`,
        "referral",
      );
    }

    // Usage counter for admin coupons (best-effort).
    if (resolved.kind !== "profile") {
      await supabase
        .from("invite_codes")
        .update({ uses: (await getUses(supabase, upper)) + 1 })
        .eq("code", upper);
    }

    return { credited: true };
  } catch (e) {
    return { credited: false, message: e instanceof Error ? e.message : "Referral failed" };
  }
}

async function getUses(supabase: any, code: string): Promise<number> {
  const { data } = await supabase
    .from("invite_codes")
    .select("uses")
    .eq("code", code)
    .maybeSingle();
  return Number(data?.uses ?? 0);
}
