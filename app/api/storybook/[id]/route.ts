import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";
import { advanceOrder, type StorybookOrderRow } from "@/lib/storybook/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Client-facing fields only (never leak generation internals). */
function publicOrder(order: StorybookOrderRow) {
  return {
    id: order.id,
    status: order.status,
    childName: order.child_name,
    theme: order.theme,
    artStyle: order.art_style,
    language: order.language,
    pageCount: order.page_count,
    title: order.story_json?.title ?? null,
    pagesDone: (order.pages ?? []).filter((p) => (p as { imageUrl?: unknown }).imageUrl).length,
    pdfReady: Boolean(order.pdf_path),
    shareSlug: order.share_slug,
    error: order.error_message,
    updatedAt: order.updated_at,
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "hero";
}

/**
 * GET /api/storybook/[id] — current order state (owner only).
 * The client polls this; the server advances the state machine under load.
 */
export async function GET(
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

  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("storybook_orders")
    .select("id, status, child_name, theme, art_style, language, page_count, story_json, pages, pdf_path, share_slug, error_message, updated_at, voice_requested, voice_status")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const row = data as {
    id: string;
    status: string;
    child_name: string;
    theme: string;
    art_style: string;
    language: string;
    page_count: number;
    story_json: { title?: string } | null;
    pages: { imageUrl?: unknown; storagePath?: unknown }[] | null;
    pdf_path: string | null;
    share_slug: string | null;
    error_message: string | null;
    updated_at: string;
    voice_requested: boolean | null;
    voice_status: string | null;
  };

  return NextResponse.json({
    order: {
      id: row.id,
      status: row.status,
      childName: row.child_name,
      theme: row.theme,
      artStyle: row.art_style,
      language: row.language,
      pageCount: row.page_count,
      title: row.story_json?.title ?? null,
      pagesDone: (row.pages ?? []).filter((p) => p.imageUrl || p.storagePath).length,
      pdfReady: Boolean(row.pdf_path),
      shareSlug: row.share_slug,
      error: row.error_message,
      updatedAt: row.updated_at,
      photoUrl: `/api/storybook/${row.id}/photo?name=${slugify(row.child_name)}`,
      voiceStatus: row.voice_status ?? (row.voice_requested ? "processing" : null),
    },
  });
}

/**
 * POST /api/storybook/[id] — advance the pipeline one stage.
 * Owner-gated; safe to call repeatedly (idempotent per state).
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

  const supabase = await getSupabaseServer();
  const { data: owned } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!owned) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const advanced = await advanceOrder(params.id);
  if (!advanced) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({ order: publicOrder(advanced) });
}

/**
 * DELETE /api/storybook/[id] — remove an order and its private assets.
 */
export async function DELETE(
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

  const admin = await getSupabaseAdmin();
  const { data: order } = await (admin as any)
    .from("storybook_orders")
    .select("id, user_id, photo_path")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Remove all private assets for this order (prefix by order id folder).
  const { data: objects } = await admin.storage
    .from("storybook-assets")
    .list(`${user.id}/${params.id}`, { limit: 100 });
  if (objects && objects.length > 0) {
    await admin.storage
      .from("storybook-assets")
      .remove(objects.map((o: { name: string }) => `${user.id}/${params.id}/${o.name}`));
  }
  if ((order as { photo_path?: string | null }).photo_path) {
    await admin.storage
      .from("storybook-assets")
      .remove([(order as { photo_path: string }).photo_path]);
  }

  await (admin as any).from("storybook_orders").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
