import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/profile — update the current user's own profile fields
 * (display_name, country). Role/credits/plan are NOT editable here.
 */
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireAuth();
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

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (b.display_name !== undefined) {
    const name = typeof b.display_name === "string" ? b.display_name.trim() : "";
    if (name.length > 80) {
      return NextResponse.json({ error: "Display name is too long (max 80 chars)" }, { status: 400 });
    }
    updates.display_name = name;
  }

  if (b.country !== undefined) {
    const country = typeof b.country === "string" ? b.country.trim() : "";
    if (country.length > 80) {
      return NextResponse.json({ error: "Country is too long (max 80 chars)" }, { status: 400 });
    }
    updates.country = country.length > 0 ? country : null;
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id, email, display_name, country, role, credits, plan, is_suspended")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
