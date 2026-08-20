import { NextResponse } from "next/server";
import { requireAuth, deductCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/storyverse/invitations — List invitations for the current user.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId");
  const type = searchParams.get("type") ?? "received"; // "received" or "sent"

  const supabase = await getSupabaseServer();

  let query;
  if (type === "sent") {
    query = supabase
      .from("storyverse_invitations")
      .select("*, storyverse_stories!storyverse_invitations_story_id_fkey(title)")
      .eq("inviter_id", user.id);
  } else {
    query = supabase
      .from("storyverse_invitations")
      .select("*, storyverse_stories!storyverse_invitations_story_id_fkey(title)")
      .eq("invitee_id", user.id);
  }

  if (storyId) query = query.eq("story_id", storyId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invitations: data ?? [] });
}

/**
 * POST /api/storyverse/invitations — Send an invitation.
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
  const { storyId, inviteeEmail } = body;

  if (!storyId || !inviteeEmail?.trim()) {
    return NextResponse.json({ error: "storyId and inviteeEmail are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Verify user is owner or co-author
  const { data: contributor } = await supabase
    .from("storyverse_contributors")
    .select("role")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .single();

  if (!contributor || (contributor.role !== "owner" && contributor.role !== "co_author")) {
    return NextResponse.json({ error: "Only story owners and co-authors can send invitations" }, { status: 403 });
  }

  // Find invitee by email
  const { data: invitee } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", inviteeEmail.trim())
    .single();

  if (!invitee) {
    return NextResponse.json({ error: "User not found with that email" }, { status: 404 });
  }

  // Check for existing pending invitation
  const { data: existing } = await supabase
    .from("storyverse_invitations")
    .select("id")
    .eq("story_id", storyId)
    .eq("invitee_id", invitee.id)
    .eq("status", "pending")
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Invitation already pending" }, { status: 400 });
  }

  // Get invite price from admin settings
  const { data: priceSetting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "storyverse_private_invite_price")
    .single();

  const invitePrice = Number(priceSetting?.value ?? 0);

  // Deduct price if > 0
  if (invitePrice > 0) {
    if ((user.profile.credits ?? 0) < invitePrice) {
      return NextResponse.json({ error: `Insufficient credits. Required: ${invitePrice}` }, { status: 402 });
    }
    await deductCredits(user.id, invitePrice, "storyverse_charge", `Invitation to story`, storyId, "storyverse_invitation");
  }

  // Create invitation
  const { data: invitation, error } = await supabase
    .from("storyverse_invitations")
    .insert({
      story_id: storyId,
      inviter_id: user.id,
      invitee_id: invitee.id,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invite_price: invitePrice,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: "invitation_sent",
    story_id: storyId,
    user_id: user.id,
    metadata: { inviteeId: invitee.id, price: invitePrice },
  });

  return NextResponse.json({ invitation }, { status: 201 });
}

/**
 * PATCH /api/storyverse/invitations — Accept or decline an invitation.
 */
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { invitationId, action } = body; // action: "accept" | "decline"

  if (!invitationId || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "invitationId and action (accept/decline) required" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  const { data: invitation } = await supabase
    .from("storyverse_invitations")
    .select("*")
    .eq("id", invitationId)
    .eq("invitee_id", user.id)
    .eq("status", "pending")
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found or already processed" }, { status: 404 });
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    await supabase.from("storyverse_invitations").update({ status: "expired" }).eq("id", invitationId);
    return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";

  await supabase
    .from("storyverse_invitations")
    .update({
      status: newStatus,
      accepted_at: action === "accept" ? new Date().toISOString() : null,
    })
    .eq("id", invitationId);

  // If accepted, add as contributor
  if (action === "accept") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, country")
      .eq("id", user.id)
      .single();

    await supabase.from("storyverse_contributors").insert({
      story_id: invitation.story_id,
      user_id: user.id,
      display_name: profile?.display_name ?? "Unknown",
      country: profile?.country ?? null,
      role: "contributor",
    });
  }

  // Log to ledger
  await supabase.from("storyverse_ledger").insert({
    event_type: action === "accept" ? "invitation_accepted" : "invitation_declined",
    story_id: invitation.story_id,
    user_id: user.id,
    metadata: { invitationId },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
