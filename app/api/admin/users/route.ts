import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin, addCredits } from "@/lib/auth/session";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { sendVerificationEmail } from "@/lib/email/resend";
import { getEnv } from "@/lib/env/runtime";

interface AdminActionError extends Error {
  statusCode?: number;
}

function unauthorized(e: unknown): NextResponse {
  const status =
    e instanceof Error && "statusCode" in e
      ? (e as AdminActionError).statusCode ?? 401
      : 401;
  return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
}

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
    return unauthorized(e);
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
    return unauthorized(e);
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
    ((await getEnv("NEXT_PUBLIC_SITE_URL")) ?? "").replace(/\/$/, "") || "https://auditai-peach.vercel.app";
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

/**
 * PATCH /api/admin/users — full user management (admin only).
 *
 * Accepts BOTH payload styles:
 *  - Field-based (what the admin UI sends): { user_id, role? | is_suspended? | credits_delta?, reason? }
 *  - Action-based: { user_id, action: "set_role" | "suspend" | "unsuspend" | "adjust_credits", ... }
 */
export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e: unknown) {
    return unauthorized(e);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const userId = typeof b.user_id === "string" ? b.user_id : "";

  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  if (userId === admin.id) {
    return NextResponse.json({ error: "You cannot modify your own admin account here" }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();

  // Guard: target must exist.
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, is_suspended, credits")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Normalize to an action, supporting both payload styles.
  const action =
    typeof b.action === "string" && b.action
      ? b.action
      : typeof b.role === "string"
        ? "set_role"
        : typeof b.is_suspended === "boolean"
          ? b.is_suspended ? "suspend" : "unsuspend"
          : b.credits_delta !== undefined
            ? "adjust_credits"
            : "";

  const suppliedReason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim() : "";

  switch (action) {
    case "set_role": {
      const role = b.role;
      if (role !== "user" && role !== "admin") {
        return NextResponse.json({ error: "role must be 'user' or 'admin'" }, { status: 400 });
      }
      const { error } = await supabase
        .from("profiles")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: `Role updated to ${role}` });
    }

    case "suspend": {
      const suspendReason = suppliedReason || "Suspended via admin panel";
      const { error } = await supabase
        .from("profiles")
        .update({
          is_suspended: true,
          suspension_reason: suspendReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Best-effort sign-out everywhere so the suspension takes effect fast.
      await supabase.auth.admin.signOut(userId);
      return NextResponse.json({ ok: true, message: "User suspended" });
    }

    case "unsuspend": {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_suspended: false,
          suspension_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "User unsuspended" });
    }

    case "adjust_credits": {
      const delta = Number(b.credits_delta);
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ error: "credits_delta must be a non-zero number" }, { status: 400 });
      }
      const adjustReason = suppliedReason || "Admin adjustment";
      try {
        await addCredits(userId, delta, "admin_adjustment", adjustReason);
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Credit adjustment failed" },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, message: `Credits adjusted by ${delta}` });
    }

    default:
      return NextResponse.json(
        { error: "Provide role, is_suspended, credits_delta, or a valid action" },
        { status: 400 },
      );
  }
}
