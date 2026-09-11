import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/storybook/[id]/photo — owner-only proxied preview of the
 * uploaded child photo. The bucket is fully private; access flows through
 * this authenticated route (no signed URLs for photos, no sharing).
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
  const photoPath = (order as { photo_path?: string | null }).photo_path;
  if (!photoPath) {
    return NextResponse.json({ error: "Photo no longer stored (retention policy)." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("storybook-assets")
    .download(photoPath);
  if (error || !data) {
    return NextResponse.json({ error: "Photo unavailable." }, { status: 500 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=3600",
    },
  });
}
