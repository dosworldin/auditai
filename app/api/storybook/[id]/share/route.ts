import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function newShareSlug(): string {
  return `sb_${randomBytes(8).toString("hex")}`;
}

/**
 * POST /api/storybook/[id]/share — create/rotate the public share link.
 * PUT  /api/storybook/[id]/share — revoke the public share link.
 *
 * Sharing exposes a read-only branded flipbook page (text + illustrations);
 * the PDF itself and the child's photo are never exposed.
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
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, status")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if ((order as { status?: string }).status !== "ready") {
    return NextResponse.json(
      { error: "Only completed storybooks can be shared." },
      { status: 409 },
    );
  }

  const slug = newShareSlug();
  const { error } = await (supabase as any)
    .from("storybook_orders")
    .update({ share_slug: slug, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Could not create the share link." }, { status: 500 });
  }
  return NextResponse.json({ shareSlug: slug, shareUrl: `/s/storybook/${slug}` });
}

export async function PUT(
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
    .select("id, user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { error } = await (admin as any)
    .from("storybook_orders")
    .update({ share_slug: null, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Could not revoke the share link." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
