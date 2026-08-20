import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/storyverse/stories/[id] — Get a story with its chapters, rounds, contributors, and contributions.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  // Get story
  const { data: story, error: storyError } = await supabase
    .from("storyverse_stories")
    .select("*")
    .eq("id", id)
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // Get contributors
  const { data: contributors } = await supabase
    .from("storyverse_contributors")
    .select("display_name, role, country, total_contributions, canon_wins")
    .eq("story_id", id)
    .order("joined_at", { ascending: true });

  // Get rounds
  const { data: rounds } = await supabase
    .from("storyverse_rounds")
    .select("*")
    .eq("story_id", id)
    .order("round_number", { ascending: true });

  // Get current round contributions (if any round is OPEN or VOTING)
  const activeRound = rounds?.find((r) => r.status === "OPEN" || r.status === "VOTING");
  let contributions: Record<string, unknown>[] = [];
  if (activeRound) {
    const { data: contribs } = await supabase
      .from("storyverse_contributions")
      .select("*")
      .eq("round_id", activeRound.id)
      .order("created_at", { ascending: true });
    contributions = contribs ?? [];
  }

  // Get chapters
  const { data: chapters } = await supabase
    .from("storyverse_chapters")
    .select("id, number, title, word_count")
    .eq("story_id", id)
    .order("number", { ascending: true });

  return NextResponse.json({
    story: {
      ...story,
      contributors: contributors ?? [],
      currentRound: story.current_round,
      totalRounds: story.total_rounds,
      coverColor: story.cover_color,
      storyType: story.story_type,
    },
    rounds: rounds ?? [],
    contributions,
    chapters: chapters ?? [],
  });
}
