import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/support/tickets — List user's tickets or all tickets (admin).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();
  let query = supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Admins see all tickets; users see only their own
  if (user.profile.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tickets: data });
}

/**
 * POST /api/support/tickets — Create a new support ticket.
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
  const { category, subject, message, priority } = body;

  if (!subject || !message) {
    return NextResponse.json({ error: "subject and message are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      category: category || "general",
      subject,
      message,
      priority: priority || "normal",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ticket }, { status: 201 });
}
