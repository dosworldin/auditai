import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; chapterId: string }> },
) {
  const { id, chapterId } = await params;
  const supabase = await getSupabaseServer();

  const { data: chapter, error } = await supabase
    .from("storyverse_chapters")
    .select("id, number, title, content, word_count")
    .eq("id", chapterId)
    .eq("story_id", id)
    .single();

  if (error || !chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  return NextResponse.json({ content: chapter.content });
}
