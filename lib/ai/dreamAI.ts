/**
 * Dream AI Analyzer — AI semantic layer.
 *
 * Uses the central provider chain (lib/ai/provider.ts — DeepSeek primary,
 * Gemini fallback, admin-configurable). All calls happen server-side only.
 *
 * Responsibilities:
 *  1. Sufficiency check — decide whether the dream description contains
 *     enough meaningful detail, and if not, produce concise follow-up
 *     questions for exactly what is missing.
 *  2. Interpretation — entertainment-oriented analysis of symbols, themes,
 *     and emotional/contextual patterns. NEVER medical/psychiatric/scientific
 *     diagnosis, NEVER supernatural or predictive certainty.
 *
 * Failure policy: functions throw on AI failure. Callers must show a
 * user-friendly error and must NOT persist a fake/partial analysis.
 */

import { callAI } from "@/lib/ai/provider";

/* ------------------------------------------------------------------ */
/*  Shared JSON parsing                                                */
/* ------------------------------------------------------------------ */

/** Extract the first JSON object from an LLM response (tolerates fences/prose). */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const MAX_DREAM_CHARS = 8000;

function clipDream(text: string): string {
  return text.length > MAX_DREAM_CHARS ? `${text.slice(0, MAX_DREAM_CHARS)}…` : text;
}

const DREAM_DISCLAIMER_INSTRUCTION = `STRICT RULES:
- Interpret dreams for ENTERTAINMENT and pattern-matching only.
- NEVER present interpretation as medical, psychiatric, or scientific diagnosis.
- NEVER claim supernatural or predictive certainty; use tentative language ("may reflect", "is often associated with").
- Base every observation ONLY on the dream text supplied. Do not invent events, people, or details that are not in the text.`;

/* ------------------------------------------------------------------ */
/*  Step 1 — Sufficiency check + follow-up questions                   */
/* ------------------------------------------------------------------ */

export interface DreamSufficiency {
  sufficient: boolean;
  followUpQuestions: string[];
  /** Missing aspects the AI identified (concise labels). */
  missing: string[];
}

const SUFFICIENCY_SYSTEM = `You are the intake step of a dream-analysis product (entertainment, not therapy).
Judge whether a dream description contains enough meaningful detail for a useful interpretation.
Meaningful detail = a narrative of what happened (events/actions), plus at least some of: who was present, where it happened, what was felt, and how it ended. A few evocative words with no story is NOT enough.
${DREAM_DISCLAIMER_INSTRUCTION}

Respond with ONLY a JSON object:
{
  "sufficient": boolean,
  "missing": ["narrative" | "people" | "setting" | "emotions" | "ending" | "objects", ...],
  "followUpQuestions": ["...", "..."]
}
If sufficient: followUpQuestions and missing must be empty arrays.
If insufficient: ask 1-3 concise follow-up questions, only about what is ACTUALLY missing, phrased for the dreamer.
Never interrogate about identity, real names, or private medical information.`;

export async function checkDreamSufficiencyWithAI(dreamText: string): Promise<DreamSufficiency> {
  const response = await callAI({
    systemPrompt: SUFFICIENCY_SYSTEM,
    prompt: `Dream description from the user:\n"""\n${clipDream(dreamText)}\n"""\n\nEvaluate sufficiency and respond with the JSON object only.`,
    temperature: 0.2,
    maxTokens: 500,
  });

  if (response.error || !response.content.trim()) {
    throw new Error(
      response.error ??
        "The AI service did not return a response. Please try again in a moment.",
    );
  }

  const parsed = extractJsonObject(response.content);
  const sufficient = parsed?.sufficient === true;
  const missingRaw = Array.isArray(parsed?.missing) ? parsed!.missing : [];
  const missing = missingRaw
    .map((m) => String(m))
    .filter((m) =>
      ["narrative", "people", "setting", "emotions", "ending", "objects"].includes(m),
    );
  const questionsRaw = Array.isArray(parsed?.followUpQuestions) ? parsed!.followUpQuestions : [];
  const followUpQuestions = questionsRaw.map(String).filter((q) => q.trim().length > 0).slice(0, 3);

  return {
    sufficient: sufficient || (missing.length === 0 && followUpQuestions.length === 0),
    missing,
    followUpQuestions: sufficient ? [] : followUpQuestions.length > 0 ? followUpQuestions : missing.map((m) => `Can you share more about the ${m} in your dream?`),
  };
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Interpretation                                            */
/* ------------------------------------------------------------------ */

export interface DreamInterpretation {
  summary: string;
  symbols: { name: string; meaning: string; quote: string }[];
  themes: { name: string; meaning: string; quote: string }[];
  emotions: { name: string; note: string; quote: string }[];
  /** Optional traditional/astrological layer — only present when requested. */
  traditional?: TraditionalAstrologicalInterpretation;
}

export interface TraditionalSymbolMeaning {
  symbol: string;
  /** Traditional/cultural meaning commonly associated with the symbol. */
  meaning: string;
  /** How the dream's context may shift that interpretation. */
  contextNote: string;
  /** Verbatim phrase from the dream text proving the symbol is present. */
  quote: string;
}

export interface TraditionalAstrologicalInterpretation {
  /** Brief framing: traditional/cultural symbolism, meanings vary. */
  intro: string;
  symbols: TraditionalSymbolMeaning[];
}

const INTERPRETATION_SYSTEM = `You are a dream interpretation engine for an entertainment product.
Analyze the dream's symbols, themes, and emotional/contextual patterns in an engaging, thoughtful way.
${DREAM_DISCLAIMER_INSTRUCTION}

Respond with ONLY a JSON object:
{
  "summary": "2-4 sentence engaging interpretation of the dream as a whole",
  "symbols": [{ "name": "short symbol label e.g. 'Flying'", "meaning": "1-2 sentences on what this symbol may reflect", "quote": "the exact phrase from the dream text this symbol was detected in" }...],
  "themes": [{ "name": "short theme label", "meaning": "1-2 sentences", "quote": "exact phrase from the dream text" }...],
  "emotions": [{ "name": "short emotion label", "note": "1 sentence on the emotional pattern", "quote": "exact phrase from the dream text" }...]
}
Rules:
- Every "quote" MUST be copied VERBATIM from the dream text. Never invent or paraphrase quotes.
- 0-5 symbols, 0-3 themes, 0-4 emotions. Prefer precision over quantity.
- If a quote cannot be verbatim, omit that entry.`;

const TRADITIONAL_ASTROLOGY_RULES = `Additionally include a "traditional" key with traditional/astrological dream-symbol meanings:
"traditional": { "intro": "1 sentence noting these are traditional/cultural symbolic associations and that meanings can vary across traditions", "symbols": [{ "symbol": "short label", "meaning": "1-2 sentences on the meaning traditionally or astrologically associated with this symbol", "contextNote": "1 sentence on how THIS dream's context may color or shift that meaning", "quote": "verbatim phrase from the dream text proving the symbol is present" }...] }
Traditional-layer rules:
- Use ONLY symbols actually present in the dream text. Never invent a symbol that is not there; every entry needs a verbatim quote.
- Present as traditional/cultural symbolism, NOT scientific fact. Never claim the dream predicts the future.
- No medical, psychiatric, or guaranteed life-event claims.
- Do NOT name a specific astrology system, book, or source — speak of "traditional symbolism" or "some traditions associate". If traditions differ, say meanings can vary.
- 0-6 entries, concise and easy to understand. If no recognizable traditional symbols exist, use an empty symbols array.`;

export interface GroundedSymbol {
  name: string;
  meaning: string;
  quote: string;
}

export async function interpretDreamWithAI(
  dreamText: string,
  options?: { includeTraditionalAstrology?: boolean },
): Promise<DreamInterpretation> {
  const includeTraditional = options?.includeTraditionalAstrology === true;
  const response = await callAI({
    systemPrompt: includeTraditional
      ? `${INTERPRETATION_SYSTEM}\n\n${TRADITIONAL_ASTROLOGY_RULES}`
      : INTERPRETATION_SYSTEM,
    prompt: `Dream description:\n"""\n${clipDream(dreamText)}\n"""\n\nRespond with the JSON object only${includeTraditional ? ", including the optional \"traditional\" key" : ""}.`,
    temperature: 0.7,
    // Slightly higher budget only when the traditional layer is requested.
    maxTokens: includeTraditional ? 2200 : 1600,
  });

  if (response.error || !response.content.trim()) {
    throw new Error(
      response.error ??
        "The AI service did not return a response. Please try again in a moment.",
    );
  }

  const parsed = extractJsonObject(response.content);
  if (!parsed) {
    throw new Error("The AI returned an unreadable analysis. Please try again.");
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (!summary) {
    throw new Error("The AI returned an incomplete analysis. Please try again.");
  }

  const pick = (arr: unknown): { name: string; meaning: string; quote: string }[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => ({
        name: String(it.name ?? "").trim(),
        meaning: String(it.meaning ?? it.note ?? "").trim(),
        quote: String(it.quote ?? "").trim(),
      }))
      .filter((it) => it.name.length > 0);
  };

  // Grounding gate: drop any entry whose "quote" does not literally appear
  // in the dream text. AI must never invent evidence.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const dreamNorm = norm(dreamText);
  const grounded = (items: { name: string; meaning: string; quote: string }[]) =>
    items.filter((it) => it.quote.length >= 3 && dreamNorm.includes(norm(it.quote)));

  // Optional traditional/astrological layer — same grounding gate: only
  // entries whose verbatim quote exists in the dream text survive, so a
  // symbol that is not actually present can never be invented.
  let traditional: TraditionalAstrologicalInterpretation | undefined;
  const traditionalRaw =
    includeTraditional &&
    typeof parsed.traditional === "object" &&
    parsed.traditional !== null
      ? (parsed.traditional as Record<string, unknown>)
      : null;
  if (traditionalRaw) {
    const intro =
      typeof traditionalRaw.intro === "string" && traditionalRaw.intro.trim()
        ? traditionalRaw.intro.trim()
        : "Traditional and cultural symbolic associations — meanings can vary across traditions and are not scientific fact.";
    const tradSymbols = Array.isArray(traditionalRaw.symbols)
      ? (traditionalRaw.symbols as unknown[])
          .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
          .map((it) => ({
            symbol: String(it.symbol ?? "").trim(),
            meaning: String(it.meaning ?? "").trim(),
            contextNote: String(it.contextNote ?? "").trim(),
            quote: String(it.quote ?? "").trim(),
          }))
          .filter((it) => it.symbol.length > 0)
          .filter((it) => it.quote.length >= 3 && dreamNorm.includes(norm(it.quote)))
          .slice(0, 6)
      : [];
    traditional = { intro, symbols: tradSymbols };
  }

  return {
    summary,
    symbols: grounded(pick(parsed.symbols)).map(({ name, meaning, quote }) => ({ name, meaning, quote })),
    themes: grounded(pick(parsed.themes)).map(({ name, meaning, quote }) => ({ name, meaning, quote })),
    emotions: grounded(pick(parsed.emotions)).map(({ name, meaning: note, quote }) => ({ name, note, quote })),
    ...(traditional ? { traditional } : {}),
  };
}
