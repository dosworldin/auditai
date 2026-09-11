import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { getStorybookSettings } from "@/lib/storybook/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/storybook/public/[slug] — public share payload (no auth).
 * Only completed + explicitly shared books are returned. Exposes at most
 * `storybook_public_preview_pages` pages (default 3) as a free preview —
 * the full book stays private and is only in the owner's PDF.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const admin = await getSupabaseAdmin();
  const { data, error } = await (admin as any)
    .from("storybook_orders")
    .select(
      "id, status, child_name, story_json, pages, share_slug",
    )
    .eq("share_slug", params.slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Storybook not found" }, { status: 404 });
  }

  const row = data as {
    id: string;
    status: string;
    child_name: string;
    story_json: { title?: string } | null;
    pages: { pageNumber?: number; text?: string | null; storagePath?: string | null; imageUrl?: string | null }[] | null;
    share_slug: string;
  };

  if (row.status !== "ready") {
    return NextResponse.json({ error: "Storybook not found" }, { status: 404 });
  }

  // Free preview limit — the rest of the book is locked for visitors.
  const settings = await getStorybookSettings();
  const previewPages = Math.max(1, settings.publicPreviewPages);

  const sorted = (row.pages ?? [])
    .slice()
    .sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0));
  const visible = sorted.slice(0, previewPages);

  const pages = visible.map((p) => ({
    pageNumber: p.pageNumber ?? 0,
    text: typeof p.text === "string" ? p.text : "",
    imageUrl: `/api/storybook/public/${row.share_slug}/page-image?page=${p.pageNumber ?? 0}`,
  }));

  return NextResponse.json({
    storybook: {
      title: row.story_json?.title ?? `A story for ${row.child_name}`,
      childName: row.child_name,
      totalPages: sorted.length,
      previewPages,
      pages,
    },
  });
}
