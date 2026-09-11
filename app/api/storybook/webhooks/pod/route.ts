import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/storybook/webhooks/pod — Lulu Direct webhook receiver.
 *
 * Configure this URL in your Lulu account's webhook settings with
 * POD_WEBHOOK_SECRET. Verifies the X-Lulu-Signature HMAC header, then syncs
 * print-job status/tracking to storybook_orders so owners see live progress
 * even between polls.
 */
export async function POST(request: Request) {
  const secret = process.env.POD_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "POD webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const sig = request.headers.get("x-lulu-signature") ?? "";
  const hmac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { id?: unknown; status?: { name?: unknown } | unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const jobId = String((payload as { id?: unknown }).id ?? "");
  const statusName = String(
    (payload as { status?: { name?: unknown } }).status?.name ??
      (payload as { status?: unknown }).status ??
      "UNKNOWN",
  );
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const admin = await getSupabaseAdmin();
  await (admin as any)
    .from("storybook_orders")
    .update({ pod_status: statusName, updated_at: new Date().toISOString() })
    .eq("pod_job_id", jobId);

  return NextResponse.json({ ok: true });
}
