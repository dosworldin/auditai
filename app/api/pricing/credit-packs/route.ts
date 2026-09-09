import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

interface PackSetting {
  label: string;
  credits: number;
  price: number;
  tagline?: string;
  featured?: boolean;
}

const DEFAULT_PACKS: PackSetting[] = [
  { label: "Starter Pack", credits: 100, price: 4.99 },
  { label: "Pro Pack", credits: 400, price: 14.99 },
  { label: "Business Pack", credits: 1000, price: 29.99 },
];

/**
 * GET /api/pricing/credit-packs
 * Returns credit-pack pricing from admin_settings (key: credit_packs).
 * Admin is the source of truth; defaults are only a fallback when unset.
 */
export async function GET() {
  const supabase = await getSupabaseServer();

  const { data: setting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "credit_packs")
    .single();

  let packs: PackSetting[] = DEFAULT_PACKS;
  let source: "admin" | "default" = "default";

  const value = setting?.value as unknown;
  if (Array.isArray(value) && value.length > 0) {
    const parsed: PackSetting[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const label = typeof rec.label === "string" ? rec.label : "";
      const credits = Number(rec.credits);
      const price = Number(rec.price);
      if (label && Number.isFinite(credits) && credits > 0 && Number.isFinite(price) && price >= 0) {
        parsed.push({
          label,
          credits,
          price,
          ...(typeof rec.tagline === "string" && rec.tagline ? { tagline: rec.tagline } : {}),
          ...(rec.featured === true ? { featured: true } : {}),
        });
      }
    }
    if (parsed.length > 0) {
      packs = parsed;
      source = "admin";
    }
  }

  return NextResponse.json({ packs, source });
}
