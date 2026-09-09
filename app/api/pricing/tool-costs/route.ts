import { NextResponse } from "next/server";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { resolveToolCredits } from "@/lib/pricing/tool-pricing";

export const dynamic = "force-dynamic";

/**
 * GET /api/pricing/tool-costs — effective per-tool credit costs.
 * Resolves admin overrides (admin_settings.tool_prices) on top of the
 * registry defaults, so the tool pages display what users are actually
 * charged. No auth required — pricing is public information.
 */
export async function GET() {
  const costs: Record<string, number> = {};
  for (const tool of TOOL_REGISTRY) {
    costs[tool.slug] = await resolveToolCredits(tool.slug, tool.pricing.creditsPerRun);
  }
  return NextResponse.json({ costs });
}
