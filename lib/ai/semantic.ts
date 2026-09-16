/**
 * AI Semantic Analysis Layer.
 *
 * Pipeline position:  Extraction → Deterministic Analysis → [AI SEMANTIC] →
 * Merge → Existing Scoring/Report.
 *
 * Contract:
 *  - The deterministic engine is NOT replaced and stays authoritative for
 *    exact calculations, amounts, dates and presence/absence checks.
 *  - AI is responsible for semantic meaning, context, ambiguity, conflicts
 *    and nuanced risks the rule engine cannot see.
 *  - Every AI finding MUST be grounded in the supplied document text — the
 *    system prompt forbids invented evidence, and findings whose evidence
 *    does not appear in the document are discarded at merge time.
 *  - Fail-soft: any error (provider down, invalid JSON, timeout) returns
 *    null and the audit completes with deterministic findings only.
 *
 * Server-side only (uses lib/ai/provider.ts which reads env/DB keys).
 */

import { callAI } from "@/lib/ai/provider";
import type { Finding, Severity, RiskLevel } from "@/lib/engine/types";

export interface SemanticInput {
  toolSlug: string;
  toolName: string;
  /** Extracted document text (already extracted — OCR only ran if required). */
  text: string;
  /** Optional second document (Document Comparison). */
  secondText?: string;
  /** Tool-specific objective/rules context. */
  toolContext: string;
  /** Existing deterministic findings — AI sees them and must not duplicate. */
  existingFindings: { title: string; explanation: string }[];
  /** Determined safety domain for tone calibration. */
  safetyDomain: string;
  /** Cap on returned findings. */
  maxFindings: number;
  /** User-selected report language. */
  language?: string;
}

export interface SemanticResult {
  findings: Finding[];
  provider: string;
  model: string;
  latencyMs: number;
  skippedReason?: string;
}

const COMMON_SYSTEM_PROMPT = `You are the semantic-analysis stage of a professional document audit engine.

The deterministic stage has already run. It is AUTHORITATIVE for exact calculations, amounts, dates, and presence/absence of clauses or patterns. Do NOT restate, recalculate, or contradict its findings.

Your job is ONLY what rules cannot do: semantic meaning, context, ambiguity, internal conflicts between clauses, inconsistent definitions, implied obligations, unfair balance of power, and nuanced domain risk.

HARD GROUNDING RULES (violating any of these makes your output invalid):
- Every finding MUST be supported by a VERBATIM quote from the provided document text (the "evidence" field). Copy the quote exactly; do not paraphrase, invent, or extend it.
- NEVER invent clauses, numbers, dates, names, amounts or facts that are not in the document.
- If the document does not contain enough substance for semantic analysis, return an empty findings array.
- Do not duplicate a deterministic finding already listed for you; only add NEW insights.
- If you are uncertain, lower the confidence value instead of guessing.

Return STRICT JSON only, no markdown fences, no commentary:
{"findings":[{"title":"short finding title","severity":"Critical|High|Medium|Low|Info","explanation":"1-3 sentences: why this matters for THIS document","evidence":"verbatim quote from the document","recommendation":"concrete action for the reader","confidence":0.0-1.0}]}
Maximum findings: {{MAX}}. Prefer fewer, high-quality findings.`;

function buildUserPrompt(input: SemanticInput): string {
  const existing = input.existingFindings.length
    ? input.existingFindings
        .slice(0, 20)
        .map((f) => `- ${f.title}: ${f.explanation}`)
        .join("\n")
    : "(none)";

  const doc = input.text.length > 24_000 ? `${input.text.slice(0, 24_000)}\n[...truncated]` : input.text;
  const second = input.secondText
    ? input.secondText.length > 12_000
      ? `${input.secondText.slice(0, 12_000)}\n[...truncated]`
      : input.secondText
    : undefined;

  return `TOOL: ${input.toolName} (${input.toolSlug})
DOMAIN: ${input.safetyDomain}
ANALYSIS OBJECTIVE / RULES: ${input.toolContext}
REPORT LANGUAGE: ${input.language ?? "en"}

DETERMINISTIC FINDINGS ALREADY REPORTED (do NOT duplicate these):
${existing}

DOCUMENT TEXT (the only source of truth for evidence):
"""
${doc}
"""${
    second !== undefined
      ? `

SECOND DOCUMENT TEXT (Document B — compare against Document A above):
"""
${second}
"""`
      : ""
  }

Produce the JSON object now.`;
}

interface RawAiFinding {
  title?: unknown;
  severity?: unknown;
  explanation?: unknown;
  evidence?: unknown;
  recommendation?: unknown;
  confidence?: unknown;
}

const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low", "Info"];
const RISK_FOR: Record<Severity, RiskLevel> = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
  Info: "None",
};

/** Extract a JSON object from a model response that may include fences/prose. */
function parseJsonLoose(raw: string): { findings?: RawAiFinding[] } | null {
  const cleaned = raw.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normQuote(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/["'\u201c\u201d\u2018\u2019]/g, "").trim();
}

/**
 * Convert validated AI findings into engine Finding objects, grounding every
 * one in the supplied document text. Findings whose evidence quote does not
 * appear in the document are DISCARDED (anti-hallucination gate).
 */
function toEngineFindings(
  raw: RawAiFinding[],
  input: SemanticInput,
): Finding[] {
  const haystack = normQuote(`${input.text}${input.secondText ? `\n${input.secondText}` : ""}`);
  const out: Finding[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (out.length >= input.maxFindings) break;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
    const evidence = typeof item.evidence === "string" ? item.evidence.trim() : "";
    const recommendation = typeof item.recommendation === "string" ? item.recommendation.trim() : "";
    const severity = SEVERITIES.find((s) => s.toLowerCase() === String(item.severity).toLowerCase()) ?? "Info";
    const confidenceRaw = typeof item.confidence === "number" ? item.confidence : 0.5;
    const confidence = Math.min(1, Math.max(0, confidenceRaw));

    if (!title || !explanation || !evidence) continue;

    // Grounding gate: the evidence quote must literally appear in the document.
    const quote = normQuote(evidence);
    if (quote.length < 12 || !haystack.includes(quote)) continue;

    // In-run dedup on title.
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: `ai-${out.length + 1}-${input.toolSlug}`,
      severity,
      category: "AI Semantic",
      title,
      explanation,
      evidence: { text: evidence.slice(0, 500), available: true },
      risk: RISK_FOR[severity],
      recommendation: recommendation || "Review this passage in context.",
      confidence: Math.round(confidence * 100) / 100,
      rule: "ai-semantic",
    });
  }
  return out;
}

/** Do AI findings duplicate deterministic ones? (title token overlap ≥ 0.6) */
function isDuplicate(aiTitle: string, existing: { title: string; explanation: string }[]): boolean {
  const tokens = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 3));
  const aiTokens = tokens(aiTitle);
  if (aiTokens.size === 0) return false;
  for (const f of existing) {
    const exTokens = tokens(f.title);
    if (exTokens.size === 0) continue;
    let overlap = 0;
    for (const t of aiTokens) if (exTokens.has(t)) overlap++;
    if (overlap / Math.min(aiTokens.size, exTokens.size) >= 0.6) return true;
  }
  return false;
}

/**
 * Run the semantic pass. Returns null on ANY failure — the caller then keeps
 * the deterministic-only report. Never throws.
 */
export async function runSemanticAnalysis(
  input: SemanticInput,
): Promise<SemanticResult | null> {
  try {
    const systemPrompt = COMMON_SYSTEM_PROMPT.replace("{{MAX}}", String(input.maxFindings));
    const response = await callAI({
      prompt: buildUserPrompt(input),
      systemPrompt,
      temperature: 0.2,
      maxTokens: 2000,
    });

    if (response.error || !response.content) {
      return null;
    }

    const parsed = parseJsonLoose(response.content);
    if (!parsed || !Array.isArray(parsed.findings)) return null;

    const grounded = toEngineFindings(parsed.findings.slice(0, input.maxFindings * 2), input);

    // Final dedup against deterministic findings.
    const existing = input.existingFindings;
    const deduped = grounded.filter((f) => !isDuplicate(f.title, existing));

    if (deduped.length === 0) {
      return {
        findings: [],
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        skippedReason: "AI returned no new grounded findings beyond the deterministic pass.",
      };
    }

    return {
      findings: deduped,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    };
  } catch {
    // Absolute fail-soft: the audit must complete without AI.
    return null;
  }
}
