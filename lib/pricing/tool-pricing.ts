/**
 * Tool/lab credit pricing + on/off resolution — server-side only.
 *
 * Admin can override the credit cost of any tool or lab via admin_settings:
 *   key: "tool_prices"  -> { [toolSlug]: credits }
 *   key: "lab_prices"   -> { [labSlug]: credits }
 *
 * Admin can also disable individual tools via admin_settings:
 *   key: "disabled_tools" -> { [toolSlug]: true }
 *
 * Registry pricing is the fallback when no override exists. The client never
 * decides pricing — this module is consumed by API routes only.
 */

import { getSupabaseServer } from "@/lib/db/supabase-server";

type PriceMap = Record<string, number>;

async function loadPriceMap(key: string): Promise<PriceMap> {
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", key)
      .single();
    const value = data?.value as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const map: PriceMap = {};
    for (const [slug, v] of Object.entries(value as Record<string, unknown>)) {
      const n = Number(v);
      if (slug && Number.isFinite(n) && n >= 0) map[slug] = n;
    }
    return map;
  } catch {
    return {};
  }
}

/** Resolve the credit cost for a tool run. */
export async function resolveToolCredits(
  toolSlug: string,
  registryCredits: number,
): Promise<number> {
  const overrides = await loadPriceMap("tool_prices");
  const override = overrides[toolSlug];
  return Number.isFinite(override) ? override : registryCredits;
}

/**
 * Returns true if the given tool is admin-disabled. When the
 * "disabled_tools" setting is missing/corrupt, tools are enabled by default.
 */
export async function isToolDisabled(toolSlug: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "disabled_tools")
      .single();
    const value = data?.value as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return (value as Record<string, unknown>)[toolSlug] === true;
  } catch {
    return false;
  }
}

/** Resolve the credit cost for a lab run. */
export async function resolveLabCredits(
  labSlug: string,
  registryCredits: number,
): Promise<number> {
  const overrides = await loadPriceMap("lab_prices");
  const override = overrides[labSlug];
  return Number.isFinite(override) ? override : registryCredits;
}
