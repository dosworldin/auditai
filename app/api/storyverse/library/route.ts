import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/storyverse/library — the user's saved/purchased stories.
 */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("storyverse_library")
    .select("*, story:storyverse_stories(id, title, description, genre, status, cover_color)")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ library: data ?? [] });
}

/**
 * POST /api/storyverse/library — add a published story to the user's shelf.
 * Only PUBLISHED / MARKETPLACE stories can be added.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const storyId = (body as Record<string, unknown>).storyId;
  if (typeof storyId !== "string" || !storyId) {
    return NextResponse.json({ error: "storyId is required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  const { data: story } = await supabase
    .from("storyverse_stories")
    .select("id, status")
    .eq("id", storyId)
    .single();

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  if (story.status !== "PUBLISHED" && story.status !== "MARKETPLACE") {
    return NextResponse.json({ error: "Only published stories can be added to your library" }, { status: 400 });
  }

  // Idempotent insert
  const { data: existing } = await supabase
    .from("storyverse_library")
    .select("id")
    .eq("user_id", user.id)
    .eq("story_id", storyId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyInLibrary: true });
  }

  const { error } = await supabase.from("storyverse_library").insert({
    user_id: user.id,
    story_id: storyId,
    access_type: "free",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
