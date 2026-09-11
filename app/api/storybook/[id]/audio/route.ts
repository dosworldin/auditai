import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/storybook/[id]/audio?page=N — owner-only narration audio proxy.
 * Streams the WAV from the private bucket; nothing is exposed publicly.
 */
export async function GET(
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

  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  if (!Number.isInteger(pageParam) || pageParam < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, narration")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const narration = ((order as { narration?: Record<string, unknown> }).narration ?? {}) as Record<string, unknown>;
  const path = narration[String(pageParam)];
  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "Narration for this page is not ready." }, { status: 404 });
  }

  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.storage.from("storybook-assets").download(path);
  if (error || !data) {
    return NextResponse.json({ error: "Audio not available." }, { status: 404 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600" },
  });
}
