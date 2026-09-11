import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth, deductCredits } from "@/lib/auth/session";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { isPodConfigured, podCostEstimate, podCreateJob, type PodAddress } from "@/lib/storybook/pod";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Map an order's page count to a Lulu POD package (A4-style paperback). */
function podPackageId(): string {
  // A4-ish paperback ("PAGE_SIZE_866X1117" = 8.66" x 11.17", i.e. A4).
  // Configurable so admins can switch to square/hardcover products later.
  return process.env.POD_PACKAGE_ID || "PAGE_SIZE_866X1117_PBW";
}

/**
 * POST /api/storybook/[id]/pod — get a live cost estimate for a printed copy.
 * Body: { name, line1, line2?, city, region?, postalCode, countryCode, phone }
 * Returns print+ship cost with the platform markup included (credits + info).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`pod-estimate:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const settings = await getStorybookSettings();
  if (!settings.podEnabled || !isPodConfigured()) {
    return NextResponse.json(
      { error: "Printed copies are not available right now." },
      { status: 403 },
    );
  }

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, status, pdf_path, page_count")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const row = order as { id: string; user_id: string; status: string; pdf_path: string | null; page_count: number };
  if (row.status !== "ready" || !row.pdf_path) {
    return NextResponse.json({ error: "The storybook PDF must be ready before ordering a print." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const s = (k: string, max = 200): string =>
    typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "";
  const name = s("name", 80);
  const line1 = s("line1", 200);
  const city = s("city", 80);
  const postalCode = s("postalCode", 20);
  const countryCode = s("countryCode", 2).toUpperCase();
  const phone = s("phone", 30);
  if (!name || !line1 || !city || !postalCode || !countryCode || !phone) {
    return NextResponse.json(
      { error: "Full shipping address (name, address, city, postal code, country, phone) is required for a quote." },
      { status: 400 },
    );
  }

  try {
    const { totalUsd } = await podCostEstimate(
      { productId: podPackageId(), pageCount: row.page_count, quantity: 1 },
      countryCode,
    );
    const markup = 1 + settings.podMarkupPercent / 100;
    const chargeUsd = Math.round(totalUsd * markup * 100) / 100;

    return NextResponse.json({
      printCostUsd: totalUsd,
      chargeUsd,
      markupPercent: settings.podMarkupPercent,
      note: "Final charge happens when you place the order; shipping times are shown at checkout.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cost estimate failed" },
      { status: 502 },
    );
  }
}

/**
 * PUT /api/storybook/[id]/pod — place the print order.
 * Charges storybook_pod_credits + sends the PDFs to Lulu with the address.
 * The PDFs are exposed to Lulu via short-lived signed URLs.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`pod-order:${user.id}`, 4, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const settings = await getStorybookSettings();
  if (!settings.podEnabled || !isPodConfigured()) {
    return NextResponse.json({ error: "Printed copies are not available right now." }, { status: 403 });
  }

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, status, pdf_path, page_count, child_name, story_json, pod_job_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const row = order as {
    id: string;
    user_id: string;
    status: string;
    pdf_path: string | null;
    page_count: number;
    child_name: string;
    story_json: { title?: string } | null;
    pod_job_id: string | null;
  };

  if (row.status !== "ready" || !row.pdf_path) {
    return NextResponse.json({ error: "The storybook PDF must be ready before ordering a print." }, { status: 409 });
  }
  if (row.pod_job_id) {
    return NextResponse.json({ error: "A print order was already placed for this storybook." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const s = (k: string, max = 200): string =>
    typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "";
  const address: PodAddress = {
    name: s("name", 80),
    line1: s("line1", 200),
    line2: s("line2", 200) || null,
    city: s("city", 80),
    region: s("region", 80) || null,
    postalCode: s("postalCode", 20),
    countryCode: s("countryCode", 2).toUpperCase(),
    phoneNumber: s("phone", 30),
  };
  if (!address.name || !address.line1 || !address.city || !address.postalCode || !address.countryCode || !address.phoneNumber) {
    return NextResponse.json({ error: "A complete shipping address is required." }, { status: 400 });
  }

  // --- Credits ---
  if (user.profile.credits < settings.podCredits) {
    return NextResponse.json(
      { error: `Insufficient credits. Required: ${settings.podCredits}, Available: ${user.profile.credits}` },
      { status: 402 },
    );
  }

  // Signed URLs for Lulu (valid 24h — long enough for their pipeline).
  const admin = await getSupabaseAdmin();
  const { data: signedInterior } = await admin.storage
    .from("storybook-assets")
    .createSignedUrl(row.pdf_path, 60 * 60 * 24);
  if (!signedInterior?.signedUrl) {
    return NextResponse.json({ error: "Could not prepare the book files for printing." }, { status: 500 });
  }

  // Charge credits first (refund on print-job failure).
  const deduction = await deductCredits(
    user.id,
    settings.podCredits,
    "pod_print_order",
    `Printed copy of "${row.story_json?.title ?? row.child_name}"`,
    row.id,
    "storybook_order",
  );
  if (!deduction.ok) {
    return NextResponse.json({ error: deduction.error ?? "Credit deduction failed" }, { status: 402 });
  }

  try {
    // NOTE: cover generation is handled by Lulu when a cover_url is omitted
    // only for their non-PDF "cover by Lulu" products; for print-ready PDF
    // products the cover is part of the interior PDF in our composer.
    const job = await podCreateJob({
      lineItems: [
        {
          productId: podPackageId(),
          pageTitle: row.story_json?.title ?? `${row.child_name}'s Storybook`,
          pageCount: row.page_count,
          interiorFileUrl: signedInterior.signedUrl,
          coverFileUrl: signedInterior.signedUrl,
          quantity: 1,
        },
      ],
      shippingAddress: address,
    });

    await (supabase as any)
      .from("storybook_orders")
      .update({ pod_job_id: job.id, pod_status: job.status, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    return NextResponse.json({ ok: true, jobId: job.id, status: job.status });
  } catch (err) {
    // Refund credits — the print job never went through.
    const { addCredits } = await import("@/lib/auth/session");
    await addCredits(user.id, settings.podCredits, "pod_print_refund", `Refund: print order failed (${row.id})`);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Print order failed" },
      { status: 502 },
    );
  }
}
