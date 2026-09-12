import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin, addCredits } from "@/lib/auth/session";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { sendVerificationEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users?query=&limit= — list all users (admin only).
 *
 * Uses the service-role client so the listing works even if the profiles
 * RLS policies are missing/misconfigured on a given environment — an admin
 * panel must never silently show an empty list because of a policy gap.
 * Also surfaces Supabase email-confirmation state for the resend action.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const supabase = await getSupabaseAdmin();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, credits, plan, country, is_suspended, suspension_reason, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch email-confirmation state from auth.users (service role only).
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const confirmed = new Map<string, boolean>();
  if (!authError && authUsers?.users) {
    for (const u of authUsers.users) {
      confirmed.set(u.id, Boolean(u.email_confirmed_at));
    }
  }

  let users = (profiles ?? []).map((p) => ({
    ...p,
    email_confirmed: confirmed.get(p.id) ?? true,
  }));

  if (query) {
    // Escape user input for PostgREST or filter
    const safe = query.replace(/[%,()]/g, "");
    if (safe) {
      const q = safe.toLowerCase();
      users = users.filter(
        (u) =>
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.display_name ?? "").toLowerCase().includes(q),
      );
    }
  }

  return NextResponse.json({ users });
}

/**
 * POST /api/admin/users — action: { user_id, action: "resend_verification" }.
 * Generates a fresh Supabase verification link for the user and emails it
 * via Resend so a lost/never-received confirmation email can be re-sent.
 */
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
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
  const b = body as Record<string, unknown>;
  const userId = typeof b.user_id === "string" ? b.user_id : "";
  const action = typeof b.action === "string" ? b.action : "";

  if (!userId || action !== "resend_verification") {
    return NextResponse.json({ error: "user_id and action='resend_verification' are required" }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "User not found in auth" }, { status: 404 });
  }
  if (userData.user.email_confirmed_at) {
    return NextResponse.json({ error: "Email is already verified" }, { status: 400 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://auditai-peach.vercel.app";
  const verifyUrl = `${siteUrl}/auth`;

  // Generate a fresh confirmation link. `password` is only applied when
  // creating a brand-new user; for an existing user it is ignored (required
  // by the type only). Some GoTrue versions reject type=signup for an
  // existing user, so fall back to a magic link — clicking it also confirms
  // the email. generateLink only RETURNS the link (no email is sent), which
  // is why we deliver it ourselves via Resend below.
  let actionLink: string | undefined;
  {
    const signup = await supabase.auth.admin.generateLink({
      type: "signup",
      email: userData.user.email!,
      password: randomUUID(),
      options: { redirectTo: verifyUrl },
    });
    if (!signup.error && signup.data?.properties?.action_link) {
      actionLink = signup.data.properties.action_link;
    } else {
      const magic = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email!,
        options: { redirectTo: verifyUrl },
      });
      if (!magic.error && magic.data?.properties?.action_link) {
        actionLink = magic.data.properties.action_link;
      } else {
        return NextResponse.json(
          { error: magic.error?.message ?? signup.error?.message ?? "Failed to generate verification link" },
          { status: 500 },
        );
      }
    }
  }

  // Send a branded email via Resend with the verification link.
  const emailResult = await sendVerificationEmail({
    to: userData.user.email!,
    displayName:
      (userData.user.user_metadata?.display_name as string | undefined) ??
      userData.user.email!.split("@")[0],
    verifyUrl: actionLink,
  });

  if (!emailResult.ok) {
    return NextResponse.json(
      { error: emailResult.error ?? "Failed to send email" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sentTo: userData.user.email });
}
