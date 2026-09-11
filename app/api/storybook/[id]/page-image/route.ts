import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/storybook/[id]/page-image?page=N — owner-only illustration proxy.
 * Serves the mirrored private copy when present, else the Leonardo CDN url.
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

  const admin = await getSupabaseAdmin();
  const { data: order } = await (admin as any)
    .from("storybook_orders")
    .select("id, user_id, pages")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pages = ((order as { pages?: unknown }).pages ?? []) as {
    pageNumber?: number;
    imageUrl?: string | null;
    storagePath?: string | null;
  }[];
  const page = pages.find((p) => Number(p.pageNumber) === pageParam);
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  if (page.storagePath) {
    const { data, error } = await admin.storage
      .from("storybook-assets")
      .download(page.storagePath);
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" },
      });
    }
  }

  if (page.imageUrl) {
    const upstream = await fetch(page.imageUrl, { signal: AbortSignal.timeout(20_000) });
    if (upstream.ok) {
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "image/png",
          "cache-control": "private, max-age=3600",
        },
      });
    }
  }

  return NextResponse.json({ error: "Illustration not ready." }, { status: 404 });
}
