import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/storyverse/stories — List stories with filtering.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const genre = searchParams.get("genre");
  const library = searchParams.get("library") === "true";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const offset = Number(searchParams.get("offset")) || 0;

  const supabase = await getSupabaseServer();

  if (library) {
    // Get user's library stories
    let user;
    try {
      user = await requireAuth();
    } catch (e: unknown) {
      const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
      return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
    }

    const { data: libEntries } = await supabase
      .from("storyverse_library")
      .select("story_id, access_type")
      .eq("user_id", user.id);

    if (!libEntries || libEntries.length === 0) {
      return NextResponse.json({ stories: [] });
    }

    const storyIds = libEntries.map((e) => e.story_id);
    const accessMap = new Map(libEntries.map((e) => [e.story_id, e.access_type]));

    const { data: stories } = await supabase
      .from("storyverse_stories")
      .select("id, title, genre, description, cover_color, status")
      .in("id", storyIds)
      .order("created_at", { ascending: false });

    const enriched = (stories ?? []).map((s) => ({
      ...s,
      accessType: accessMap.get(s.id) ?? "saved",
    }));

    return NextResponse.json({ stories: enriched });
  }

  let query = supabase
    .from("storyverse_stories")
    .select("*, storyverse_contributors(count)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (genre) query = query.eq("genre", genre);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stories: data });
}

/**
 * POST /api/storyverse/stories — Create a new story.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { title, description, genre, language, storyType, originCountry, tags } = body;

  if (!title || !description || !genre || !storyType) {
    return NextResponse.json({ error: "title, description, genre, and storyType are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Create the story
  const { data: story, error: storyError } = await supabase
    .from("storyverse_stories")
    .insert({
      title,
      description,
      genre,
      language: language || "English",
      story_type: storyType,
      owner_id: user.id,
      status: "DRAFT",
      invite_required: storyType === "pool_private",
      origin_country: originCountry ?? null,
      tags: tags ?? [],
      cover_color: ["indigo", "teal", "amber", "rose", "violet", "sky", "emerald"][Math.floor(Math.random() * 7)],
    })
    .select()
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: storyError?.message ?? "Failed to create story" }, { status: 500 });
  }

  // Add owner as first contributor
  await supabase.from("storyverse_contributors").insert({
    story_id: story.id,
    user_id: user.id,
    display_name: user.profile.display_name,
    country: user.profile.country,
    role: "owner",
  });

  // Create wallet if not exists
  await supabase.from("storyverse_wallets").upsert({
    user_id: user.id,
    total_earned: 0,
    pending_balance: 0,
    available_balance: 0,
    total_payouts: 0,
  }, { onConflict: "user_id" });

  // Ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: "story_lifecycle",
    story_id: story.id,
    user_id: user.id,
    metadata: { action: "created", storyType, title },
  });

  return NextResponse.json({ story }, { status: 201 });
}
