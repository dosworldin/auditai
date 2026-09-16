import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import {
  MANAGED_CONFIG_KEYS,
  MANAGED_SECRET_KEYS,
  getEnv,
  saveEnvValue,
  deleteEnvValue,
  maskSecret,
  clearEnvCache,
} from "@/lib/env/runtime";

export const dynamic = "force-dynamic";

function guard(e: unknown): NextResponse | null {
  if (!e) return null;
  const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
  return NextResponse.json({ error: "Unauthorized" }, { status });
}

/**
 * GET /api/admin/env           — masked status of every managed credential
 * GET /api/admin/env?reveal=KEY — full value (admin only, single key)
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return guard(e)!;
  }

  const { searchParams } = new URL(request.url);
  const reveal = searchParams.get("reveal");

  if (reveal) {
    const value = await getEnv(reveal);
    if (value === undefined) {
      return NextResponse.json({ error: "Not set" }, { status: 404 });
    }
    return NextResponse.json({ key: reveal, value });
  }

  const supabase = await getSupabaseAdmin();

  // Which overrides exist in the DB? (Service role can read secret rows too —
  // values are masked before they ever leave this handler.)
  const dbKeys = new Set<string>();
  const dbValues = new Map<string, string>();
  {
    const { data } = await supabase.from("admin_settings").select("key, value").like("key", "env:%");
    for (const row of data ?? []) {
      const name = String(row.key).slice("env:".length);
      dbKeys.add(name);
      dbValues.set(name, String(row.value));
    }
  }
  {
    const { data } = await supabase.from("secret_admin_settings").select("key, value").like("key", "env_secret:%");
    for (const row of data ?? []) {
      const name = String(row.key).slice("env_secret:".length);
      dbKeys.add(name);
      dbValues.set(name, String(row.value));
    }
  }

  const entries = [
    ...MANAGED_SECRET_KEYS.map((k) => ({
      key: k.key,
      label: k.label,
      group: k.group,
      where: k.where,
      kind: "secret" as const,
      db_override: dbKeys.has(k.key),
    })),
    ...MANAGED_CONFIG_KEYS.map((k) => ({
      key: k.key,
      label: k.label,
      group: k.group,
      placeholder: k.placeholder,
      kind: "config" as const,
      db_override: dbKeys.has(k.key),
    })),
  ].map((e) => {
    let source: "db" | "env" | "unset" = "unset";
    let preview = "";
    if (dbKeys.has(e.key)) {
      source = "db";
      const raw = dbValues.get(e.key) ?? "";
      preview = e.kind === "secret" ? maskSecret(raw) : raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
    } else {
      const envValue = process.env[e.key];
      if (envValue) {
        source = "env";
        preview = e.kind === "secret" ? maskSecret(envValue) : envValue.length > 40 ? `${envValue.slice(0, 40)}…` : envValue;
      }
    }
    return { ...e, source, preview, masked: e.kind === "secret" };
  });

  return NextResponse.json({ entries });
}

/**
 * PUT /api/admin/env — save a managed credential/config.
 * Body: { key, value }
 */
export async function PUT(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return guard(e)!;
  }

  const body = await request.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const value = typeof b.value === "string" ? b.value.trim() : "";

  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  if (!value) return NextResponse.json({ error: "value is required" }, { status: 400 });

  const result = await saveEnvValue(key, value);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Stamp who changed it (best-effort; secrets table has updated_by column).
  try {
    const supabase = await getSupabaseAdmin();
    const secret = MANAGED_SECRET_KEYS.some((k) => k.key === key);
    await supabase
      .from(secret ? "secret_admin_settings" : "admin_settings")
      .update({ updated_by: admin.profile.id, updated_at: new Date().toISOString() })
      .eq("key", secret ? `env_secret:${key}` : `env:${key}`);
  } catch {
    // non-critical
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/env?key=NAME — remove the DB override so process.env wins again.
 */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return guard(e)!;
  }

  const { searchParams } = new URL(request.url);
  const key = (searchParams.get("key") ?? "").trim();
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const result = await deleteEnvValue(key);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** POST /api/admin/env — refresh cache (after bulk edits / deploy changes). */
export async function POST() {
  try {
    await requireAdmin();
  } catch (e) {
    return guard(e)!;
  }
  clearEnvCache();
  return NextResponse.json({ ok: true, cleared: true });
}
