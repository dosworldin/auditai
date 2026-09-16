/**
 * Admin live-activity notifications.
 *
 * `notifyAdmin()` is the single funnel every platform event flows through:
 *  1. Inserts a row into `admin_activity` (drives the live badges in the
 *     admin dashboard).
 *  2. Sends an email to the admin notification address (Admin → Settings →
 *     admin_notify_email) when the master switch is on.
 *
 * Best-effort by design: a notification failure must never break the user's
 * actual flow, so every step is wrapped and failures are logged only.
 */

import { getSupabaseServer } from "@/lib/db/supabase-server";
import { sendAdminNotificationEmail } from "@/lib/email/resend";
import { getEnv } from "@/lib/env/runtime";

export type ActivityEventType =
  | "signup"
  | "support_ticket"
  | "payout_request"
  | "payment_request"
  | "storybook_order"
  | "audit_run"
  | "lab_run"
  | "referral_join";

/** Which events should trigger an email (high-value only — runs are too noisy). */
const EMAIL_EVENTS = new Set<ActivityEventType>([
  "signup",
  "support_ticket",
  "payout_request",
  "payment_request",
  "storybook_order",
  "referral_join",
]);

export interface NotifyOptions {
  type: ActivityEventType;
  summary: string;
  detail?: Record<string, unknown>;
}

/** Resolve the admin notification email. Priority: admin DB setting → env. */
async function resolveAdminEmail(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "admin_notify_email")
      .maybeSingle();
    const fromDb = typeof data?.value === "string" ? data.value.trim() : "";
    if (fromDb && fromDb.includes("@")) return fromDb;
  } catch {
    // fall through
  }
  const fromEnv = (await getEnv("ADMIN_NOTIFY_EMAIL"))?.trim();
  return fromEnv && fromEnv.includes("@") ? fromEnv : null;
}

async function emailsEnabled(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "admin_notify_enabled")
      .maybeSingle();
    if (data?.value === false || data?.value === "false") return false;
  } catch {
    // default: enabled
  }
  return true;
}

/**
 * Record an admin activity event and (for important events) email the admin.
 * Never throws — safe to call from any route without try/catch.
 */
export async function notifyAdmin(options: NotifyOptions): Promise<void> {
  const { type, summary, detail } = options;
  try {
    const supabase: any = await getSupabaseServer();

    // 1. Activity feed row (powers dashboard badges)
    await supabase.from("admin_activity").insert({
      event_type: type,
      summary,
      detail: detail ?? {},
    });

    // 2. Email notification for high-value events
    if (!EMAIL_EVENTS.has(type)) return;
    if (!(await emailsEnabled(supabase))) return;
    const adminEmail = await resolveAdminEmail(supabase);
    if (!adminEmail) return;

    const siteUrl = (await getEnv("NEXT_PUBLIC_SITE_URL")) ?? "";
    await sendAdminNotificationEmail({
      adminEmail,
      subject: `AuditAI: ${summary}`,
      title: "Platform activity",
      bodyHtml: `
        <p style="margin:0 0 12px;">${escapeHtml(summary)}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Event: ${type} · ${new Date().toISOString()}</p>
        ${siteUrl ? `<a href="${siteUrl}/admin" style="color:#2563eb;">Open admin dashboard →</a>` : ""}`,
    });
  } catch (e) {
    // Never let notifications break user flows.
    console.warn(`notifyAdmin(${type}) failed:`, e instanceof Error ? e.message : e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
