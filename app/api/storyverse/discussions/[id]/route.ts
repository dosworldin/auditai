import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: discussion, error } = await supabase
    .from("storyverse_discussions")
    .select("*, profiles!storyverse_discussions_user_id_fkey(display_name)")
    .eq("id", id)
    .single();

  if (error || !discussion) {
    return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
  }

  const { data: replies } = await supabase
    .from("storyverse_discussion_replies")
    .select("*, profiles!storyverse_discussion_replies_user_id_fkey(display_name)")
    .eq("discussion_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ discussion, replies: replies ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  const { data: reply, error } = await supabase
    .from("storyverse_discussion_replies")
    .insert({
      discussion_id: id,
      user_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reply }, { status: 201 });
}
