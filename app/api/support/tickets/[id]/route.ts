import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { sendSupportReplyEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/**
 * GET /api/support/tickets/[id] — Get ticket detail + replies.
 */
export async function GET(
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

  const supabase = await getSupabaseServer();

  // Get ticket
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Non-admins can only see their own tickets
  if (user.profile.role !== "admin" && ticket.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get replies
  const { data: replies } = await supabase
    .from("support_replies")
    .select("*, profiles!support_replies_user_id_fkey(display_name, role)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ticket,
    replies: replies ?? [],
  });
}

/**
 * PATCH /api/support/tickets/[id] — Update ticket status/priority (admin only).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { status: newStatus, priority } = body;

  const supabase = await getSupabaseServer();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (newStatus) updates.status = newStatus;
  if (priority) updates.priority = priority;

  const { error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/support/tickets/[id] — Add a reply to a ticket.
 */
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

  const supabase = await getSupabaseServer();

  // Verify ticket exists and user has access
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (user.profile.role !== "admin" && ticket.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { message, is_internal_note } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Only admins can create internal notes
  const isInternal = user.profile.role === "admin" && is_internal_note === true;

  const { data: reply, error } = await supabase
    .from("support_replies")
    .insert({
      ticket_id: id,
      user_id: user.id,
      message: message.trim(),
      is_internal_note: isInternal,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update ticket status to in_progress if it was open
  if (user.profile.role === "admin") {
    await supabase
      .from("support_tickets")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "open");

    // Email the ticket owner (best-effort; fails silently if Resend is not configured)
    if (!isInternal) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", ticket.user_id)
        .single();
      if (ownerProfile?.email) {
        const { data: ticketRow } = await supabase
          .from("support_tickets")
          .select("subject")
          .eq("id", id)
          .single();
        await sendSupportReplyEmail({
          to: ownerProfile.email,
          ticketSubject: ticketRow?.subject ?? "your ticket",
          replyMessage: message.trim(),
          replyAuthor: user.profile.display_name || "The AuditAI Support Team",
        });
      }
    }
  }

  return NextResponse.json({ reply }, { status: 201 });
}
