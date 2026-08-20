/**
 * Server-side auth helpers.
 * Used in API routes and Server Components to verify authentication and authorization.
 */

import { getSupabaseServer } from "@/lib/db/supabase-server";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin" | "support";
  avatar_url: string | null;
  country: string | null;
  credits: number;
  total_credits_used: number;
  plan: string;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
}

/**
 * Get the currently authenticated user with their profile.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return null;

    return {
      id: user.id,
      email: user.email ?? "",
      profile: profile as unknown as Profile,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication — throws if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  if (user.profile.is_suspended) {
    throw new AuthError("Account is suspended", 403);
  }
  return user;
}

/**
 * Require admin role — throws if not admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.profile.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

/**
 * Check if the user has enough credits for an operation.
 */
export function hasEnoughCredits(profile: Profile, cost: number): boolean {
  return (profile.credits ?? 0) >= cost;
}

/**
 * Deduct credits from a user and log the transaction.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  eventType: string,
  description: string,
  referenceId?: string,
  referenceType?: string,
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  const supabase = await getSupabaseServer();

  // Get current balance
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single() as { data: { credits: number } | null; error: unknown };

  if (fetchError || !profile) {
    return { ok: false, error: "Failed to read balance" };
  }

  if ((profile.credits ?? 0) < amount) {
    return { ok: false, error: "Insufficient credits" };
  }

  const newBalance = Math.round(((profile.credits ?? 0) - amount) * 100) / 100;

  // Deduct credits
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      credits: newBalance,
      total_credits_used: Math.round((profile.credits - newBalance + 0) * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    return { ok: false, error: "Failed to deduct credits" };
  }

  // Log to ledger
  await supabase.from("credit_ledger").insert({
    user_id: userId,
    event_type: eventType,
    amount: -amount,
    balance_after: newBalance,
    description,
    reference_id: referenceId ?? null,
    reference_type: referenceType ?? null,
  });

  return { ok: true, newBalance };
}

/**
 * Add credits to a user (e.g., signup bonus, refund, admin adjustment).
 */
export async function addCredits(
  userId: string,
  amount: number,
  eventType: string,
  description: string,
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  const supabase = await getSupabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (!profile) return { ok: false, error: "User not found" };

  const newBalance = Math.round((profile.credits + amount) * 100) / 100;

  await supabase
    .from("profiles")
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq("id", userId);

  await supabase.from("credit_ledger").insert({
    user_id: userId,
    event_type: eventType,
    amount,
    balance_after: newBalance,
    description,
  });

  return { ok: true, newBalance };
}

/**
 * Check if user has used their free promotion for a tool.
 */
export async function checkPromotionUsage(
  userId: string,
  toolSlug: string,
): Promise<{ used: boolean; allowed: boolean }> {
  const supabase = await getSupabaseServer();

  // Get promotion setting
  const { data: setting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "promotion_enabled")
    .single();

  const promotionEnabled = setting?.value === true || setting?.value === "true";

  if (!promotionEnabled) return { used: false, allowed: false };

  // Count uses for this tool
  const { count } = await supabase
    .from("audit_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tool_slug", toolSlug);

  const usesPerTool = 1; // Configurable via admin_settings
  const used = (count ?? 0) >= usesPerTool;

  return { used, allowed: !used };
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}
