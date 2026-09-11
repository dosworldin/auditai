import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth, addCredits, deductCredits } from "@/lib/auth/session";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

// `credits_spent` is no longer read here (retry budgeting is ledger-based),
// but the supabase-server import above remains used by the ownership check.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/storybook/[id]/retry — re-run a failed order.
 *
 * Contract (kept simple and predictable):
 *  - Retries resume from where the pipeline stopped: the story text and any
 *    completed illustrations are kept (status resets to `story_ready`, not
 *    `draft`, when a story already exists).
 *  - The first 2 retries are FREE; retry #3 onwards costs
 *    `storybook_regenerate_page_credits` to cover API spend. The count is
 *    derived from prior `storybook_retry` ledger rows for this order, so it
 *    survives order state resets.
 *  - Hard limit: 3 retries per order (free or paid).
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`storybook-retry:${user.id}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, status, credits_spent, photo_path")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const row = order as {
    id: string;
    user_id: string;
    status: string;
    credits_spent: number;
    photo_path: string | null;
  };

  if (row.status !== "failed") {
    return NextResponse.json({ error: "Only failed orders can be retried." }, { status: 400 });
  }

  // Photo retention may have deleted the source photo; retry then needs a
  // fresh consent + photo, so block instead of generating without likeness.
  if (!row.photo_path) {
    return NextResponse.json(
      { error: "The photo has been deleted (retention policy). Please create a new storybook with a fresh photo." },
      { status: 409 },
    );
  }

  const settings = await getStorybookSettings();

  // --- Retry budget: count prior retries from the credit ledger ---
  const { count: priorRetries } = await (supabase as any)
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("reference_id", row.id)
    .in("event_type", ["storybook_retry", "storybook_retry_surcharge"]);

  const MAX_RETRIES = 3;
  const FREE_RETRIES = 2;
  if ((priorRetries ?? 0) >= MAX_RETRIES) {
    return NextResponse.json(
      { error: "Retry limit reached for this storybook. Please create a new one." },
      { status: 429 },
    );
  }

  const needsSurcharge = (priorRetries ?? 0) >= FREE_RETRIES && settings.regeneratePageCredits > 0;
  if (needsSurcharge) {
    const charge = await deductCredits(
      user.id,
      settings.regeneratePageCredits,
      "storybook_retry_surcharge",
      `Storybook retry surcharge (${row.id})`,
      row.id,
      "storybook_order",
    );
    if (!charge.ok) {
      return NextResponse.json(
        { error: `Retry requires ${settings.regeneratePageCredits} credits: ${charge.error}` },
        { status: 402 },
      );
    }
  }

  // Resume, don't restart: when the story + character reference already
  // exist, jump straight back into the illustration stage so completed
  // pages are not thrown away.
  const { data: full } = await (supabase as any)
    .from("storybook_orders")
    .select("story_json, leonardo_ref_image_id, pages")
    .eq("id", row.id)
    .single();
  const fullRow = (full ?? {}) as {
    story_json?: unknown;
    leonardo_ref_image_id?: string | null;
    pages?: unknown[] | null;
  };
  const hasStory = Boolean(fullRow.story_json) && Boolean(fullRow.leonardo_ref_image_id);
  const hasAnyPages = Array.isArray(fullRow.pages) && fullRow.pages.length > 0;
  const resumeStatus = hasStory && hasAnyPages ? "story_ready" : "draft";

  const { error: resetErr } = await (supabase as any)
    .from("storybook_orders")
    .update({
      status: resumeStatus,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (resetErr) {
    // Refund the surcharge if the reset failed.
    if (needsSurcharge) {
      await addCredits(
        user.id,
        settings.regeneratePageCredits,
        "storybook_retry_surcharge_refund",
        `Refund: retry reset failed (${row.id})`,
      );
    }
    return NextResponse.json({ error: "Could not reset the order." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resumedFrom: resumeStatus });
}
