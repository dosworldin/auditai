import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { SAMPLE_STORIES, sampleImagePath } from "@/lib/storybook/samples";

export const dynamic = "force-dynamic";

/**
 * GET /api/storybook/samples — list readymade sample storybooks (public).
 * No AI calls: text is pre-written; illustrations are lazy-seeded once and
 * then served from the private bucket through the public sample-image proxy.
 */
export async function GET() {
  const settings = await getStorybookSettings();
  if (!settings.samplesEnabled) {
    return NextResponse.json({ samples: [] });
  }

  const admin = await getSupabaseAdmin();
  const samples = await Promise.all(
    SAMPLE_STORIES.map(async (s) => {
      const pages = s.pages.map((p, i) => ({
        pageNumber: i + 1,
        text: p.text,
        imageUrl: `/api/storybook/samples/${s.slug}/page-image?page=${i + 1}`,
      }));

      // Cheap readiness check on page 1 only (single object head).
      const { data } = await admin.storage
        .from("storybook-assets")
        .list(`samples/${s.slug}`, { limit: 2, search: "p1.png" });
      const seeded = Boolean(data && data.length > 0);

      return {
        slug: s.slug,
        title: s.title,
        tagline: s.tagline,
        emoji: s.emoji,
        artStyle: s.artStyle,
        ageRange: s.ageRange,
        pages,
        ready: seeded,
        expectedPath: sampleImagePath(s.slug, 1),
      };
    }),
  );

  return NextResponse.json({ samples });
}
