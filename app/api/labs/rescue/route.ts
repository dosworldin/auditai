import { NextResponse } from "next/server";
import { requireAuth, deductCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/resend";
import { sendRescueSms, placeRescueCall, isTwilioConfigured } from "@/lib/messaging/twilio";
import { notifyAdmin } from "@/lib/admin/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Normalizes common Indian/global formats to E.164. Returns null when hopeless. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? digits : null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`; // IN mobile
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function rescueEmailHtml(script: string, situation: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1d21;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <h2 style="margin:0 0 8px;font-size:20px;">🚪 Your exit script is ready</h2>
      ${situation ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Situation: ${esc(situation)}</p>` : ""}
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;font-size:15px;line-height:1.7;white-space:pre-wrap;">${esc(script)}</div>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
        Read it out, show it as a message, or use it word-for-word. Delivered by AuditAI Social Escape.
      </p>
    </div>
  </body>
</html>`;
}

interface RescueBody {
  channel?: string;
  email?: string;
  phone?: string;
  script?: string;
  situation?: string;
  delaySeconds?: number;
  simulateCall?: boolean;
}

export async function POST(request: Request) {
  // --- Auth ---
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status =
      e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`rescue:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: RescueBody;
  try {
    body = (await request.json()) as RescueBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!script) return NextResponse.json({ error: "script is required" }, { status: 400 });
  if (script.length > 4000)
    return NextResponse.json({ error: "script too long (max 4000 chars)" }, { status: 400 });

  const situation = typeof body.situation === "string" ? body.situation.slice(0, 200) : "";
  const channel = body.channel === "call" ? "call" : body.channel === "sms" ? "sms" : "email";
  const delaySeconds = Math.max(0, Math.min(300, Math.floor(body.delaySeconds ?? 0)));

  // --- Settings + credits ---
  const supabase = await getSupabaseServer();
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", ["rescue_enabled", "rescue_sms_credits", "rescue_email_credits"]);
  const settingMap = new Map((settings ?? []).map((s) => [s.key, String(s.value)]));
  if ((settingMap.get("rescue_enabled") ?? "true").toLowerCase() === "false") {
    return NextResponse.json({ error: "Rescue delivery is currently disabled." }, { status: 403 });
  }
  const cost =
    channel === "email"
      ? Number(settingMap.get("rescue_email_credits") ?? 0) || 0
      : Number(settingMap.get("rescue_sms_credits") ?? 1) || 0;

  if (cost > 0 && user.profile.credits < cost) {
    return NextResponse.json(
      { error: `Insufficient credits. Required: ${cost}, Available: ${user.profile.credits}` },
      { status: 402 },
    );
  }

  // --- Validate per channel ---
  if (channel === "email") {
    const email = (body.email ?? "").trim();
    if (!isValidEmail(email))
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });

    const sent = await sendEmail({
      to: email,
      subject: "🚪 Your exit script — AuditAI Social Escape",
      html: rescueEmailHtml(script, situation),
      text: script,
    });
    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error ?? "Email could not be sent" },
        { status: 502 },
      );
    }
    if (cost > 0) {
      await deductCredits(user.id, cost, "rescue_email", "Social Escape rescue email");
    }
    notifyAdmin({
      type: "lab_run",
      summary: `Rescue email sent by ${user.profile.display_name || user.email || user.id}`,
      detail: { channel: "email", user_id: user.id },
    });
    return NextResponse.json({ ok: true, channel: "email", creditsCharged: cost });
  }

  // --- SMS / Call (Twilio) ---
  if (!(await isTwilioConfigured())) {
    return NextResponse.json(
      {
        error:
          "SMS/call delivery is not set up yet. Admin must add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER (Admin → Credentials). Email delivery works without Twilio.",
      },
      { status: 501 },
    );
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone)
    return NextResponse.json(
      { error: "A valid phone number is required (10-digit Indian mobile or +E.164)" },
      { status: 400 },
    );

  if (channel === "sms") {
    const smsBody = situation
      ? `${script}`
      : script;
    const sent =
      delaySeconds > 0
        ? await scheduleSms(phone, smsBody, delaySeconds)
        : await sendRescueSms(phone, smsBody);
    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error ?? "SMS could not be sent", configured: sent.configured },
        { status: 502 },
      );
    }
    if (cost > 0) {
      await deductCredits(user.id, cost, "rescue_sms", "Social Escape rescue SMS");
    }
    notifyAdmin({
      type: "lab_run",
      summary: `Rescue SMS sent by ${user.profile.display_name || user.email || user.id}`,
      detail: { channel: "sms", user_id: user.id, delayed: delaySeconds > 0 },
    });
    return NextResponse.json({
      ok: true,
      channel: "sms",
      delayed: delaySeconds > 0,
      creditsCharged: cost,
    });
  }

  // channel === "call"
  const fallback =
    "Hello! This is an urgent call. Please step out for a moment — there is something important you need to handle right away.";
  const sent = await placeRescueCall(phone, script, fallback);
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error ?? "Call could not be placed", configured: sent.configured },
      { status: 502 },
    );
  }
  if (cost > 0) {
    await deductCredits(user.id, cost, "rescue_call", "Social Escape rescue call");
  }
  notifyAdmin({
    type: "lab_run",
    summary: `Rescue call placed by ${user.profile.display_name || user.email || user.id}`,
    detail: { channel: "call", user_id: user.id },
  });
  return NextResponse.json({ ok: true, channel: "call", creditsCharged: cost });
}

/** Scheduled SMS via Twilio (send_at). Falls back to immediate send when scheduling is rejected. */
async function scheduleSms(phone: string, smsBody: string, delaySeconds: number) {
  const { getEnv } = await import("@/lib/env/runtime");
  const sid = await getEnv("TWILIO_ACCOUNT_SID");
  const token = await getEnv("TWILIO_AUTH_TOKEN");
  const from = await getEnv("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) return { ok: false, configured: false, error: "Twilio is not configured" };
  const sendAt = new Date(Date.now() + delaySeconds * 1000);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: from,
        Body: smsBody.slice(0, 1500),
        SendAt: sendAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        ScheduleType: "fixed",
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const data: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true as const, configured: true };
    // Scheduling not supported on this number/type — send immediately rather than fail the rescue.
    return await sendRescueSms(phone, smsBody);
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err instanceof Error ? err.message : "Twilio request failed",
    };
  }
}
