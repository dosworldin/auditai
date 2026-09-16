/**
 * Twilio messaging (SMS + Voice) — Social Escape rescue delivery.
 *
 * Server-side only. Credentials come from the admin env runtime (DB override →
 * process.env fallback). All functions fail soft: when Twilio is not
 * configured they return { ok: false, configured: false } so the UI can show
 * a clear "not set up" state instead of crashing.
 */

import { getEnv } from "@/lib/env/runtime";

export interface MessagingResult {
  ok: boolean;
  configured: boolean;
  sid?: string;
  error?: string;
}

async function twilioCreds(): Promise<{
  sid: string;
  token: string;
  from: string;
} | null> {
  const sid = await getEnv("TWILIO_ACCOUNT_SID");
  const token = await getEnv("TWILIO_AUTH_TOKEN");
  const from = await getEnv("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

async function twilioFetch(
  path: string,
  creds: { sid: string; token: string },
  params: Record<string, string>,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "message" in data
          ? String((data as Record<string, unknown>).message)
          : `Twilio error (${res.status})`;
      return { ok: false, error: msg };
    }
    const sid =
      data && typeof data === "object" && "sid" in data
        ? String((data as Record<string, unknown>).sid)
        : undefined;
    return { ok: true, sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio request failed" };
  }
}

/** Send an SMS. E.164 format required for `to` (e.g. +919876543210). */
export async function sendRescueSms(to: string, body: string): Promise<MessagingResult> {
  const creds = await twilioCreds();
  if (!creds) return { ok: false, configured: false, error: "Twilio is not configured" };
  const r = await twilioFetch("Messages.json", creds, {
    To: to,
    From: creds.from,
    Body: body.slice(0, 1500),
  });
  return { ...r, configured: true };
}

/**
 * Place a rescue voice call. TwiML speaks the script with short pauses so the
 * user has a believable reason to leave. fallbackScript is read when the
 * custom script is empty.
 */
export async function placeRescueCall(
  to: string,
  script: string,
  fallbackScript: string,
): Promise<MessagingResult> {
  const creds = await twilioCreds();
  if (!creds) return { ok: false, configured: false, error: "Twilio is not configured" };
  const spoken = (script.trim() || fallbackScript)
    .replace(/[<>&"]/g, " ")
    .slice(0, 1200);
  const twiml =
    `<Response><Pause length="1"/>` +
    `<Say voice="Polly.Aditi" language="hi-IN">${spoken}</Say>` +
    `<Pause length="1"/>` +
    `<Say voice="Polly.Aditi" language="hi-IN">Please call me back as soon as you can. Bye.</Say>` +
    `</Response>`;
  const r = await twilioFetch("Calls.json", creds, {
    To: to,
    From: creds.from,
    Twiml: twiml,
  });
  return { ...r, configured: true };
}

/** True when all three Twilio env vars are present in env or admin DB. */
export async function isTwilioConfigured(): Promise<boolean> {
  return (await twilioCreds()) !== null;
}
