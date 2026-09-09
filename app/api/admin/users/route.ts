import { NextResponse } from "next/server";
import { requireAdmin, addCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users?query=&limit= — list user profiles (admin only).
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

  const supabase = await getSupabaseServer();
  let req = supabase
    .from("profiles")
    .select("id, email, display_name, role, credits, plan, country, is_suspended, suspension_reason, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query) {
    // Escape user input for PostgREST or filter
    const safe = query.replace(/[%,()]/g, "");
    if (safe) {
      req = req.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`);
    }
  }

  const { data, error } = await req;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [] });
}

/**
 * PATCH /api/admin/users — update a user (suspend/unsuspend, role, credits adjust).
 * Credit adjustments always go through the ledger.
 */
export async function PATCH(request: Request) {
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
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  if (userId === admin.id && (b.role !== undefined || b.is_suspended !== undefined)) {
    return NextResponse.json(
      { error: "Admins cannot change their own role or suspension status" },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServer();

  // --- Credit adjustment (ledger-backed) ---
  if (b.credits_delta !== undefined) {
    const delta = Number(b.credits_delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: "credits_delta must be a non-zero number" }, { status: 400 });
    }
    const result =
      delta > 0
        ? await addCredits(userId, delta, "admin_adjustment", typeof b.reason === "string" && b.reason ? b.reason : `Admin adjustment by ${admin.email}`)
        : await (async () => {
            // For deduction, read balance first to avoid negative balances
            const { data: profile } = await supabase
              .from("profiles")
              .select("credits")
              .eq("id", userId)
              .single();
            const current = Number(profile?.credits ?? 0);
            const amount = Math.min(-delta, current);
            if (amount <= 0) return { ok: true as const, newBalance: current };
            const { deductCredits } = await import("@/lib/auth/session");
            return deductCredits(userId, amount, "admin_adjustment", typeof b.reason === "string" && b.reason ? b.reason : `Admin deduction by ${admin.email}`);
          })();
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Credit adjustment failed" }, { status: 400 });
    }
  }

  // --- Profile fields ---
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.is_suspended !== undefined) {
    updates.is_suspended = Boolean(b.is_suspended);
    updates.suspension_reason = b.is_suspended
      ? typeof b.reason === "string" && b.reason
        ? b.reason
        : "Suspended by admin"
      : null;
  }
  if (b.role !== undefined) {
    const role = String(b.role);
    if (!["user", "admin", "support"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
  }

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
