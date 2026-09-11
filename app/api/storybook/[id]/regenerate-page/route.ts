import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { requireAuth, deductCredits, addCredits } from "@/lib/auth/session";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/storybook/[id]/regenerate-page — re-illustrate one page.
 *
 * Business rules:
 *  - Only for `ready` orders (PDF exists).
 *  - First regeneration of a page is FREE; later ones cost
 *    storybook_regenerate_page_credits.
 *  - The page is cleared and the order re-enters the normal pipeline
 *    (illustrating → composing_pdf), so a fresh PDF is composed automatically.
 *  - Works with the direct provider chain (Gemini image first, Leonardo
 *    fallback); the child's photo is re-used for likeness when still present.
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

  const rl = rateLimit(`storybook-regen:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: { page?: unknown };
  try {
    body = (await request.json()) as { page?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const pageNumber = Number(body.page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, status, pages")
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
    pages: {
      pageNumber: number;
      illustrationPrompt?: string;
      imageUrl?: string | null;
      generationId?: string | null;
      storagePath?: string | null;
      regenCount?: number;
    }[];
  };

  if (row.status !== "ready") {
    return NextResponse.json(
      { error: "The storybook must be completed before pages can be regenerated." },
      { status: 409 },
    );
  }

  const pages = row.pages ?? [];
  const idx = pages.findIndex((p) => Number(p.pageNumber) === pageNumber);
  if (idx === -1) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // --- Credits: first regen free, later ones charged ---
  const settings = await getStorybookSettings();
  const regenCount = Number(pages[idx].regenCount ?? 0);
  const owed = regenCount === 0 ? 0 : settings.regeneratePageCredits;
  if (owed > 0) {
    const charge = await deductCredits(
      user.id,
      owed,
      "storybook_page_regen",
      `Page ${pageNumber} regeneration (${row.id})`,
      row.id,
      "storybook_order",
    );
    if (!charge.ok) {
      return NextResponse.json(
        { error: `Regeneration costs ${owed} credits: ${charge.error}` },
        { status: 402 },
      );
    }
  }

  // Clear the page; the pipeline re-illustrates it with the direct provider
  // chain and recomposes the PDF on the next advance cycle.
  pages[idx] = {
    ...pages[idx],
    imageUrl: null,
    generationId: null,
    storagePath: null,
    regenCount: regenCount + 1,
  };

  const { error: updateErr } = await (supabase as any)
    .from("storybook_orders")
    .update({
      pages,
      status: "illustrating",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateErr) {
    if (owed > 0) {
      await addCredits(
        user.id,
        owed,
        "storybook_page_regen_refund",
        `Refund: regen update failed (${row.id} p${pageNumber})`,
      );
    }
    return NextResponse.json({ error: "Could not queue the regeneration." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    chargedCredits: owed,
    pollUrl: `/api/storybook/${row.id}`,
  });
}
