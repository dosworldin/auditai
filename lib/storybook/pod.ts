/**
 * Print-on-demand (POD) fulfillment — Lulu Direct (Lulu Press) Print API.
 *
 * Lulu is the book POD with a real public REST API for custom (one-off)
 * books: you submit an print job with interior PDF + cover PDF + shipping
 * address, they print and ship worldwide from local print facilities, and
 * you receive cost + tracking via the API/webhooks.
 *
 *   • Print jobs:      POST https://api.lulu.com/print-jobs/
 *   • Cost calculator: POST https://api.lulu.com/print-jobs/cost-calculators/  (or GET with line_items param)
 *   • Auth:            OAuth2 client-credentials against https://api.lulu.com/oauth2/token
 *   • Keys:            LULU_CLIENT_KEY / LULU_CLIENT_SECRET  (sandbox + production)
 *   • Optional POD webhook secret: POD_WEBHOOK_SECRET
 *
 * Lulu's account is connected once (you create print-enabled products in
 * your Lulu account for each trim size, e.g. "PAGE_SIZE_866X1117" → A4-ish).
 */

const API_BASE = process.env.POD_API_BASE || "https://api.lulu.com";

export interface PodAddress {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  countryCode: string; // ISO 3166-1 alpha-2
  phoneNumber: string;
  email?: string;
}

export interface PodLineItem {
  productId: string; // Lulu SKU, e.g. "PAGE_SIZE_866X1117_PBW" (A4 paperback)
  pageTitle: string;
  pageCount: number; // interior page count (safety-checked to 32–814 by Lulu)
  interiorFileUrl: string;
  coverFileUrl: string;
  quantity: number;
}

export interface PodJob {
  id: string;
  status: string;
  createdAt?: string;
  trackingUrls?: { id: number; url: string; attributes?: { carrier?: string } }[];
  lineItems?: Record<string, unknown>[];
  [key: string]: unknown;
}

let cachedToken: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  const key = process.env.POD_CLIENT_KEY || process.env.LULU_CLIENT_KEY;
  const secret = process.env.POD_CLIENT_SECRET || process.env.LULU_CLIENT_SECRET;
  if (!key || !secret) throw new Error("POD_CLIENT_KEY / POD_CLIENT_SECRET are not configured");

  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.token;

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: key,
      client_secret: secret,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`POD auth failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

/** Public: is POD configured? */
export function isPodConfigured(): boolean {
  return Boolean((process.env.POD_CLIENT_KEY || process.env.LULU_CLIENT_KEY) &&
    (process.env.POD_CLIENT_SECRET || process.env.LULU_CLIENT_SECRET));
}

/** Estimate printing + shipping cost (USD). */
export async function podCostEstimate(
  item: Pick<PodLineItem, "productId" | "pageCount" | "quantity">,
  countryCode: string,
): Promise<{ totalUsd: number }> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/print-jobs/cost-calculators/?line_items=[{"page_count":${item.pageCount},"pod_package_id":"${item.productId}","quantity":${item.quantity}}]&currency=USD&country_code=${encodeURIComponent(countryCode)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`POD cost estimate failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => null)) as {
    results?: { line_item_costs?: { total_cost_incl_tax?: { amount?: string | number } }[] }[];
  } | null;
  if (!data) return { totalUsd: 0 };
  const total =
    data.results?.[0]?.line_item_costs?.reduce(
      (sum, c) => sum + Number(c.total_cost_incl_tax?.amount ?? 0),
      0,
    ) ?? 0;
  return { totalUsd: total };
}

/** Submit a print job for fulfillment. */
export async function podCreateJob(options: {
  lineItems: PodLineItem[];
  shippingAddress: PodAddress;
}): Promise<PodJob> {
  const token = await getToken();

  const body = {
    line_items: options.lineItems.map((li) => ({
      title: li.pageTitle.slice(0, 100),
      page_count: li.pageCount,
      pod_package_id: li.productId,
      quantity: li.quantity,
      interior_url: li.interiorFileUrl,
      cover_url: li.coverFileUrl,
    })),
    shipping_address: {
      name: options.shippingAddress.name,
      line1: options.shippingAddress.line1,
      line2: options.shippingAddress.line2 ?? "",
      city: options.shippingAddress.city,
      state_code: options.shippingAddress.region ?? "",
      postcode: options.shippingAddress.postalCode,
      country_code: options.shippingAddress.countryCode,
      phone_number: options.shippingAddress.phoneNumber,
      email: options.shippingAddress.email ?? undefined,
      is_business: false,
    },
  };

  const res = await fetch(`${API_BASE}/print-jobs/`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data) {
    const msg = "detail" in (data ?? {}) ? String((data as { detail?: unknown }).detail) : `POD create failed ${res.status}`;
    throw new Error(msg.slice(0, 400));
  }

  return {
    id: String(data.id ?? ""),
    status: String((data.status as { name?: string } | undefined)?.name ?? "CREATED"),
    createdAt: typeof data.date_created === "string" ? data.date_created : undefined,
    trackingUrls: (data.tracking_urls as PodJob["trackingUrls"]) ?? [],
    lineItems: (data.line_items as Record<string, unknown>[]) ?? [],
    ...data,
  } as PodJob;
}

/** Fetch job status (used by the status endpoint + webhook-less polling). */
export async function podGetJob(jobId: string): Promise<PodJob | null> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/print-jobs/${encodeURIComponent(jobId)}/`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  return {
    id: String(data.id ?? jobId),
    status: String((data.status as { name?: string } | undefined)?.name ?? "UNKNOWN"),
    trackingUrls: (data.tracking_urls as PodJob["trackingUrls"]) ?? [],
    lineItems: (data.line_items as Record<string, unknown>[]) ?? [],
    ...data,
  } as PodJob;
}
