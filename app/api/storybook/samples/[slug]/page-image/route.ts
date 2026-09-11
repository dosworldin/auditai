import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { sampleImagePath } from "@/lib/storybook/samples";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/storybook/samples/[slug]/page-image?page=N — public image proxy
 * for the readymade sample stories. Serves only bucket paths under
 * samples/<slug>/ so nothing else can be reached through this route.
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const settings = await getStorybookSettings();
  if (!settings.samplesEnabled) {
    return NextResponse.json({ error: "Samples are disabled." }, { status: 403 });
  }

  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "0");
  if (!Number.isInteger(pageParam) || pageParam < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const path = sampleImagePath(params.slug, pageParam);
  // Path safety: must be exactly samples/<one-segment>/<file>.png
  if (!/^samples\/[a-z0-9-]+\/p\d+\.png$/i.test(path)) {
    return NextResponse.json({ error: "Invalid sample path" }, { status: 400 });
  }

  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.storage.from("storybook-assets").download(path);
  if (error || !data) {
    return NextResponse.json({ error: "Sample illustration not ready yet." }, { status: 404 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
}
