import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { getStorybookSettings } from "@/lib/storybook/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/storybook/public/[slug]/page-image?page=N — unauthenticated image
 * proxy for SHARED storybooks only. Serves exclusively the mirrored private
 * bucket copy (never the child's photo, never the PDF), and ONLY pages within
 * the free preview range (default 3 pages) — page N > preview gets a 404 so
 * the lock is real, not just a UI state.
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  if (!Number.isInteger(pageParam) || pageParam < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const settings = await getStorybookSettings();
  const previewPages = Math.max(1, settings.publicPreviewPages);
  if (pageParam > previewPages) {
    return NextResponse.json({ error: "This page is beyond the free preview." }, { status: 403 });
  }

  const admin = await getSupabaseAdmin();
  const { data, error } = await (admin as any)
    .from("storybook_orders")
    .select("id, status, share_slug, pages")
    .eq("share_slug", params.slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Storybook not found" }, { status: 404 });
  }

  const row = data as {
    id: string;
    status: string;
    share_slug: string;
    pages: { pageNumber?: number; storagePath?: string | null }[] | null;
  };

  if (row.status !== "ready") {
    return NextResponse.json({ error: "Storybook not found" }, { status: 404 });
  }

  const page = (row.pages ?? []).find((p) => Number(p.pageNumber) === pageParam);
  if (!page?.storagePath) {
    return NextResponse.json({ error: "Illustration not available." }, { status: 404 });
  }

  const { data: file, error: dlErr } = await admin.storage
    .from("storybook-assets")
    .download(page.storagePath);
  if (dlErr || !file) {
    return NextResponse.json({ error: "Illustration not available." }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
}
