import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAdmin } from "@/lib/auth/session";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { getSample, sampleImagePath } from "@/lib/storybook/samples";
import { generateIllustration } from "@/lib/storybook/illustrate";
import { artStylePrompt } from "@/lib/storybook/story";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/storybook/samples/seed — ADMIN ONLY.
 * Generates the readymade sample illustrations through the same direct
 * provider chain as real orders (Gemini image → Leonardo fallback). Each
 * sample has a pre-written cartoon hero description, so no photo is needed.
 * Idempotent: pages that already exist in the bucket are skipped.
 */
export async function POST(_request: Request) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const admin = await getSupabaseAdmin();
  const settings = await getStorybookSettings();

  const results: { slug: string; page: number; ok: boolean; error?: string }[] = [];

  for (const sample of [getSample("luna-and-the-moon-rocket"), getSample("the-tea-shop-at-the-end-of-the-lane"), getSample("the-dragon-who-was-scared-of-mornings"), getSample("grandmas-secret-recipe")]) {
    if (!sample) continue;
    for (let i = 0; i < sample.pages.length; i++) {
      const pageNumber = i + 1;
      const path = sampleImagePath(sample.slug, pageNumber);
      const { data: existing } = await admin.storage
        .from("storybook-assets")
        .list(`samples/${sample.slug}`, { limit: 10, search: `p${pageNumber}.png` });
      if (existing && existing.some((o) => o.name === `p${pageNumber}.png`)) {
        results.push({ slug: sample.slug, page: pageNumber, ok: true, error: "exists" });
        continue;
      }

      try {
        const prompt = `Children's storybook illustration. ${sample.pages[i].illustrationPrompt}. Hero: ${sample.heroDescription} — keep the EXACT same character design in every scene. Style: ${artStylePrompt(sample.artStyle)}. No text, no words, no watermarks.`;
        const { buffer } = await generateIllustration(
          { prompt, width: 1024, height: 768 },
          settings.imageProvider,
        );
        const { error } = await admin.storage
          .from("storybook-assets")
          .upload(path, buffer, { contentType: "image/png", upsert: true });
        if (error) throw new Error(error.message);
        results.push({ slug: sample.slug, page: pageNumber, ok: true });
      } catch (err) {
        results.push({
          slug: sample.slug,
          page: pageNumber,
          ok: false,
          error: err instanceof Error ? err.message.slice(0, 200) : "failed",
        });
      }
    }
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
