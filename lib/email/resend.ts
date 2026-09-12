/**
 * Resend transactional email service.
 *
 * Server-side only. Reads RESEND_API_KEY from the environment. All functions
 * fail soft (return { ok: false }) when the key is missing so that flows
 * relying on Supabase Auth's built-in emails keep working.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Sender, e.g. "AuditAI <onboarding@resend.dev>". Configurable via admin_settings email_from. */
  from?: string;
  replyTo?: string;
}

function defaultFrom(): string {
  return process.env.RESEND_FROM_EMAIL || "AuditAI <onboarding@resend.dev>";
}

async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from ?? defaultFrom(),
        to: [options.to],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "message" in data
          ? String((data as Record<string, unknown>).message)
          : `Resend error (${res.status})`;
      return { ok: false, error: msg };
    }

    const id =
      data && typeof data === "object" && "id" in data
        ? String((data as Record<string, unknown>).id)
        : undefined;
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}

function wrapTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1d21;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <h2 style="margin:0 0 16px;font-size:20px;">${title}</h2>
      ${bodyHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
        AuditAI — automated audit results are informational and not a substitute for professional advice.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Verification (confirm-signup) email sent when an admin re-sends the
 * confirmation link for a user whose original email never arrived.
 */
export async function sendVerificationEmail(options: {
  to: string;
  displayName: string;
  verifyUrl: string;
}): Promise<SendEmailResult> {
  const body = `
    <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(options.displayName)}</strong>,</p>
    <p style="margin:0 0 12px;">Please confirm your email address to activate your AuditAI account.</p>
    <p style="margin:0 0 16px;">
      <a href="${options.verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
        Verify my email →
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Or paste this link into your browser:<br />
      <span style="word-break:break-all;">${options.verifyUrl}</span></p>`;
  return sendEmail({
    to: options.to,
    subject: "Verify your email — AuditAI",
    html: wrapTemplate("Confirm your email address", body),
  });
}

export async function sendAdminNotificationEmail(options: {
  adminEmail: string;
  subject: string;
  title: string;
  bodyHtml: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: options.adminEmail,
    subject: options.subject,
    html: wrapTemplate(options.title, options.bodyHtml),
  });
}

export async function sendSupportReplyEmail(options: {
  to: string;
  ticketSubject: string;
  replyMessage: string;
  replyAuthor: string;
}): Promise<SendEmailResult> {
  const body = `
    <p style="margin:0 0 12px;">${options.replyAuthor} replied to your support ticket
      <strong>${escapeHtml(options.ticketSubject)}</strong>:</p>
    <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #3b82f6;background:#f8fafc;">
      ${escapeHtml(options.replyMessage)}
    </blockquote>
    <p style="margin:0;">Open your ticket on the platform to respond.</p>`;
  return sendEmail({
    to: options.to,
    subject: `Re: ${options.ticketSubject} — AuditAI Support`,
    html: wrapTemplate("New reply on your support ticket", body),
  });
}

export async function sendPaymentApprovedEmail(options: {
  to: string;
  credits: number;
  packageLabel: string | null;
}): Promise<SendEmailResult> {
  const body = `
    <p style="margin:0 0 12px;">Your payment for
      <strong>${escapeHtml(options.packageLabel ?? "credits")}</strong> has been approved.</p>
    <p style="margin:0 0 8px;"><strong>${options.credits} credits</strong> have been added to your wallet.</p>`;
  return sendEmail({
    to: options.to,
    subject: "Payment approved — credits added",
    html: wrapTemplate("Your credits are ready", body),
  });
}

export async function sendPayoutStatusEmail(options: {
  to: string;
  status: "approved" | "rejected" | "paid";
  amount: number;
  reason?: string;
}): Promise<SendEmailResult> {
  const label =
    options.status === "approved"
      ? "approved and is being processed"
      : options.status === "rejected"
        ? `rejected${options.reason ? `: ${options.reason}` : ""}`
        : "marked as paid";
  const body = `
    <p style="margin:0 0 12px;">Your payout request of <strong>$${options.amount.toFixed(2)}</strong>
      has been ${label}.</p>
    ${
      options.status === "rejected"
        ? `<p style="margin:0;">The amount has been returned to your StoryVerse balance.</p>`
        : ""
    }`;
  return sendEmail({
    to: options.to,
    subject: `Payout ${options.status} — $${options.amount.toFixed(2)}`,
    html: wrapTemplate("Payout status update", body),
  });
}

export async function sendStorybookReadyEmail(options: {
  to: string;
  childName: string;
  storyTitle: string;
}): Promise<SendEmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const body = `
    <p style="margin:0 0 12px;">The personalized storybook for
      <strong>${escapeHtml(options.childName)}</strong> is ready! 🎉</p>
    <p style="margin:0 0 12px;"><strong>${escapeHtml(options.storyTitle)}</strong></p>
    <p style="margin:0;"><a href="${siteUrl}/storybook" style="color:#2563eb;">Open your storybook →</a></p>`;
  return sendEmail({
    to: options.to,
    subject: `Your storybook "${options.storyTitle}" is ready 🎉`,
    html: wrapTemplate("Your storybook is ready", body),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
