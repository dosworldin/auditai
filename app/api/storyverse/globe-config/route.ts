import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

const GLOBE_KEYS = [
  "storyverse_globe_enabled",
  "storyverse_globe_min_gap_seconds",
  "storyverse_globe_max_gap_seconds",
  "storyverse_globe_disappear_seconds",
  "storyverse_globe_initial_delay_seconds",
] as const;

function toNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * GET /api/storyverse/globe-config — public read of the globe widget settings.
 * Only timing/visibility knobs are exposed; no secrets.
 */
export async function GET() {
  const supabase: any = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("admin_settings")
    .select("key, value")
    .in("key", [...GLOBE_KEYS]);

  const defaults = {
    enabled: true,
    minGapSeconds: 5,
    maxGapSeconds: 15,
    disappearSeconds: 7,
    initialDelaySeconds: 3.5,
  };

  if (error) {
    // Fail open with defaults so the page still renders.
    return NextResponse.json({ config: defaults });
  }

  const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));

  const enabledRaw = map.get("storyverse_globe_enabled");
  const minGap = toNumber(map.get("storyverse_globe_min_gap_seconds"), defaults.minGapSeconds);
  const maxGap = toNumber(map.get("storyverse_globe_max_gap_seconds"), defaults.maxGapSeconds);

  return NextResponse.json({
    config: {
      enabled: enabledRaw === undefined ? defaults.enabled : Boolean(enabledRaw),
      minGapSeconds: minGap,
      maxGapSeconds: Math.max(maxGap, minGap),
      disappearSeconds: toNumber(map.get("storyverse_globe_disappear_seconds"), defaults.disappearSeconds),
      initialDelaySeconds: toNumber(
        map.get("storyverse_globe_initial_delay_seconds"),
        defaults.initialDelaySeconds,
      ),
    },
  });
}
