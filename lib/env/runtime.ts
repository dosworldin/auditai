/**
 * Runtime environment resolver — admin-managed credentials.
 *
 * Every credential the platform uses (AI keys, PayPal, Resend, POD, …) is
 * resolved in a fixed order:
 *
 *   1. `admin_settings` (key `env_*`) — what the admin set in the Credentials
 *      tab. Takes priority because it is editable at runtime without a redeploy.
 *   2. `process.env` — the classic deployment env var (dev .env.local / Vercel).
 *   3. `undefined`.
 *
 * Secrets live in the `secret_admin_settings` table (service-role only, no
 * RLS exposure via the public settings API) while non-secret values stay in
 * the regular `admin_settings` table.
 *
 * Values are cached in-memory for 60s so a burst of AI requests does not
 * hammer the DB; the admin panel forces a refresh by writing through
 * `saveEnvValue` (same process) or naturally via cache expiry.
 */

import { getSupabaseAdmin } from "@/lib/db/supabase-server";

/** Non-secret managed config (also readable via the normal settings API). */
export const MANAGED_CONFIG_KEYS = [
  { key: "DEEPSEEK_BASE_URL", label: "DeepSeek API base URL", group: "AI Providers", placeholder: "https://api.deepseek.com/v1" },
  { key: "DEEPSEEK_MODEL", label: "DeepSeek model", group: "AI Providers", placeholder: "deepseek-chat" },
  { key: "GEMINI_MODEL", label: "Gemini text model", group: "AI Providers", placeholder: "gemini-1.5-flash" },
  { key: "GEMINI_IMAGE_MODEL", label: "Gemini image model (Storybooks)", group: "AI Providers", placeholder: "gemini-2.5-flash-image" },
  { key: "GEMINI_TTS_MODEL", label: "Gemini TTS model (Storybooks)", group: "AI Providers", placeholder: "gemini-2.5-flash-preview-tts" },
  { key: "POD_PACKAGE_ID", label: "Lulu print package ID", group: "Print on Demand", placeholder: "PAGE_SIZE_866X1117_PBW" },
  { key: "POD_API_BASE", label: "Lulu API base", group: "Print on Demand", placeholder: "https://api.sandbox.lulu.com" },
  { key: "RESEND_FROM_EMAIL", label: "Resend from address", group: "Email", placeholder: "AuditAI <onboarding@resend.dev>" },
  { key: "NEXT_PUBLIC_SITE_URL", label: "Public site URL", group: "General", placeholder: "https://auditai-peach.vercel.app" },
] as const;

/** Secret credentials stored in the service-role-only table. */
export const MANAGED_SECRET_KEYS = [
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek API key", group: "AI Providers", where: "deepseek.com → API keys" },
  { key: "GEMINI_API_KEY", label: "Gemini API key (text + images + voice)", group: "AI Providers", where: "aistudio.google.com → Get API key" },
  { key: "LEONARDO_API_KEY", label: "Leonardo.Ai API key (illustration fallback)", group: "AI Providers", where: "app.leonardo.ai → API" },
  { key: "POD_CLIENT_KEY", label: "Lulu client key", group: "Print on Demand", where: "lulu.com → developer console" },
  { key: "POD_CLIENT_SECRET", label: "Lulu client secret", group: "Print on Demand", where: "lulu.com → developer console" },
  { key: "POD_WEBHOOK_SECRET", label: "Lulu webhook secret", group: "Print on Demand", where: "lulu.com → webhook settings" },
  { key: "PAYPAL_CLIENT_ID", label: "PayPal client ID", group: "Payments", where: "developer.paypal.com → Apps & Credentials" },
  { key: "PAYPAL_CLIENT_SECRET", label: "PayPal client secret", group: "Payments", where: "developer.paypal.com → Apps & Credentials" },
  { key: "RESEND_API_KEY", label: "Resend API key (emails)", group: "Email", where: "resend.com → API Keys" },
] as const;

export type ManagedKey = (typeof MANAGED_SECRET_KEYS)[number]["key"] | (typeof MANAGED_CONFIG_KEYS)[number]["key"];

const SECRET_PREFIX = "env_secret:";
const CONFIG_PREFIX = "env:";

interface CacheEntry {
  value: string | null;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheGet(key: string): string | null | undefined {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  return undefined;
}

function cacheSet(key: string, value: string | null) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

/** Clear the resolver cache (called after admin writes). */
export function clearEnvCache() {
  cache.clear();
}

function settingKeyFor(name: string, secret: boolean): string {
  return secret ? `${SECRET_PREFIX}${name}` : `${CONFIG_PREFIX}${name}`;
}

/**
 * Resolve a managed credential/config at runtime.
 * DB override (admin panel) → process.env → fallback value.
 */
export async function getEnv(
  name: string,
  fallback?: string,
): Promise<string | undefined> {
  // 1. In-memory cache
  const cached = cacheGet(name);
  if (cached !== undefined) return cached ?? fallback;

  const secret = MANAGED_SECRET_KEYS.some((k) => k.key === name);
  const settingKey = settingKeyFor(name, secret);

  let dbValue: string | null = null;
  try {
    const supabase = await getSupabaseAdmin();
    const table = secret ? "secret_admin_settings" : "admin_settings";
    const { data } = await supabase
      .from(table)
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();
    if (data && typeof data.value === "string" && data.value.length > 0) {
      dbValue = data.value;
    }
  } catch {
    // DB unreachable — fall through to process.env
  }

  const resolved = dbValue ?? process.env[name] ?? null;
  cacheSet(name, resolved);
  return resolved ?? fallback;
}

/** Store a managed credential/config (admin panel write path). */
export async function saveEnvValue(name: string, value: string): Promise<{ ok: boolean; error?: string }> {
  const secret = MANAGED_SECRET_KEYS.some((k) => k.key === name);
  const known =
    secret || MANAGED_CONFIG_KEYS.some((k) => k.key === name);
  if (!known) return { ok: false, error: `Unknown managed key: ${name}` };

  const settingKey = settingKeyFor(name, secret);
  const supabase = await getSupabaseAdmin();
  const table = secret ? "secret_admin_settings" : "admin_settings";

  const { error } = await supabase.from(table).upsert({
    key: settingKey,
    value,
    category: secret ? "credentials" : "config",
    description: `Managed via Admin → Credentials (${name})`,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  clearEnvCache();
  return { ok: true };
}

/** Delete a managed override so the resolver falls back to process.env. */
export async function deleteEnvValue(name: string): Promise<{ ok: boolean; error?: string }> {
  const secret = MANAGED_SECRET_KEYS.some((k) => k.key === name);
  const settingKey = settingKeyFor(name, secret);
  const supabase = await getSupabaseAdmin();
  const table = secret ? "secret_admin_settings" : "admin_settings";
  const { error } = await supabase.from(table).delete().eq("key", settingKey);
  if (error) return { ok: false, error: error.message };
  clearEnvCache();
  return { ok: true };
}

/** Mask a secret for display: keep first 4 + last 4 chars. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.min(20, value.length - 8))}${value.slice(-4)}`;
}
