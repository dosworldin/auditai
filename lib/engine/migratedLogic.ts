/**
 * Migrated former Labs — engine wiring + AI-layer resolution.
 *
 * These slugs previously ran via /api/labs/run with handlers in
 * lib/engine/labLogic.ts. They now run through /api/audit/run with the exact
 * same handlers (thin adapter in pipeline.ts) — nothing was rewritten.
 *
 * This module is also the single resolver for tool logic + AI-layer config:
 * migrated labs first, then the classic TOOL_LOGIC map.
 */

import type { SafetyDomain } from "@/lib/engine/types";
import type { ToolLogic } from "@/lib/engine/toolLogic";
import { getToolLogic } from "@/lib/engine/toolLogic";
import { getEnv } from "@/lib/env/runtime";

export const AI_ENABLED_NOTE =
  "This tool also runs a semantic AI pass to add context-aware findings when the AI layer is configured.";

function legacy(
  slug: string,
  safetyDomain: SafetyDomain,
  aiEnabled = true,
): ToolLogic {
  return {
    slug,
    safetyDomain,
    checks: [],
    classifierHints: [slug],
    aiEnabled,
  };
}

export const TOOL_LOGIC_MIGRATED: Record<string, ToolLogic> = {
  "sentiment-tone-analyzer": legacy("sentiment-tone-analyzer", "general"),
  "contract-style-tuner": legacy("contract-style-tuner", "legal"),
  "negotiation-coach": legacy("negotiation-coach", "legal"),
  "risk-explainer": legacy("risk-explainer", "legal"),
  "document-clustering": legacy("document-clustering", "general"),
  "smart-redaction": legacy("smart-redaction", "security"),
  "document-qna": legacy("document-qna", "general", true),
  "citation-validator": legacy("citation-validator", "general"),
  "literature-scanner": legacy("literature-scanner", "general"),
  "claim-verifier": legacy("claim-verifier", "general"),
  "prompt-injection-tester": legacy("prompt-injection-tester", "security"),
  "pii-detector": legacy("pii-detector", "security"),
  "link-reputation-scanner": legacy("link-reputation-scanner", "security"),
  "regulation-change-tracker": legacy("regulation-change-tracker", "legal"),
  "jurisdiction-mapper": legacy("jurisdiction-mapper", "legal"),
  "consent-record-auditor": legacy("consent-record-auditor", "security"),
  "metadata-inspector": legacy("metadata-inspector", "general"),
  "document-forensics": legacy("document-forensics", "security"),
  "timeline-reconstructor": legacy("timeline-reconstructor", "general"),
  "agentic-negotiation": legacy("agentic-negotiation", "legal", false),
  "multimodal-contract-vision": legacy("multimodal-contract-vision", "legal", false),
  "autonomous-compliance-agent": legacy("autonomous-compliance-agent", "legal", false),
};

/** Per-tool AI context overrides (Custom AI Audit + Document Comparison). */
export const AI_CONTEXT_OVERRIDES: Record<
  string,
  (config?: Record<string, string | number | boolean>) => string
> = {
  "custom-ai-audit": (config) => {
    const focus =
      typeof config?.focusAreas === "string" && config.focusAreas.trim()
        ? config.focusAreas.trim()
        : "overall document quality, hidden risks, unclear obligations";
    return (
      `The user defined this audit objective/rules: "${focus}". ` +
      "Prioritize semantic findings that directly address the user's stated objective. " +
      "Quote the document verbatim as evidence for every finding."
    );
  },
  "document-comparison": () =>
    "Two document versions are provided as DOCUMENT A and DOCUMENT B. Focus on: changed obligations, " +
    "added or removed rights, shifted liability, altered amounts, dates or deadlines, and any newly " +
    "introduced one-sided terms. Evidence must quote the exact changed passage and state which document (A or B) it comes from.",
};

/** Per-tool cap on semantic findings. */
export const AI_MAX_FINDINGS_OVERRIDES: Record<string, number> = {
  "document-comparison": 10,
};

/**
 * Resolve the effective tool logic across both maps: migrated former labs
 * first, then the classic tool map.
 */
export function getEffectiveToolLogic(slug: string): ToolLogic | undefined {
  return TOOL_LOGIC_MIGRATED[slug] ?? getToolLogic(slug);
}

/**
 * Should the AI semantic layer run for this tool?
 * Default ON for every registered tool (semantic value-add across the
 * engine); a tool opts OUT by setting aiEnabled=false (the three Coming
 * Soon Future AI entries do). Admin-wide kill-switch is also honored in
 * the pipeline.
 */
export function isAiEnabledFor(slug: string): boolean {
  const logic = getEffectiveToolLogic(slug);
  if (!logic) return false;
  return logic.aiEnabled !== false;
}

/** Cap on semantic findings for a tool (AI budget control). */
export function aiMaxFindingsFor(slug: string): number {
  return (
    AI_MAX_FINDINGS_OVERRIDES[slug] ??
    getEffectiveToolLogic(slug)?.aiMaxFindings ??
    8
  );
}

/** Tool-specific AI context (objective/rules) for the semantic layer. */
export function aiContextFor(
  slug: string,
  config?: Record<string, string | number | boolean>,
): string {
  const override = AI_CONTEXT_OVERRIDES[slug];
  if (override) return override(config);
  return "Apply the tool's purpose and the common audit standard. Flag issues a domain expert would flag for this tool's purpose.";
}

/** Admin kill-switch for the AI semantic layer (default: on). */
export async function semanticLayerEnabled(): Promise<boolean> {
  try {
    const v = await getEnv("AI_SEMANTIC_ENABLED");
    if (v === "false" || v === "0") return false;
  } catch {
    // fall through to default-on
  }
  return true;
}
