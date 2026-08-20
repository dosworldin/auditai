import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId");

  const supabase = await getSupabaseServer();

  let query = supabase
    .from("storyverse_discussions")
    .select("*, profiles!storyverse_discussions_user_id_fkey(display_name)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (storyId) query = query.eq("story_id", storyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discussions: data ?? [] });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { storyId, title, content } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  const { data: discussion, error } = await supabase
    .from("storyverse_discussions")
    .insert({
      story_id: storyId ?? null,
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discussion }, { status: 201 });
}
