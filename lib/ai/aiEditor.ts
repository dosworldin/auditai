import { callAI } from "@/lib/ai/provider";

/**
 * StoryVerse AI Editor — continuity + copyright review of a winning
 * contribution. All AI calls flow through the admin-managed provider
 * chain (lib/ai/provider.ts), so failover, limit handling and custom
 * providers are automatic.
 */

export interface ContinuityResult {
  /** 0-100 — how well the contribution fits the story so far */
  continuityScore: number;
  issues: string[];
  notes: string;
}

export interface CopyrightResult {
  /** true if the text looks like close reproduction of known/quoted work */
  potentialIssue: boolean;
  /** matched phrases / reasons */
  flags: string[];
  notes: string;
}

export interface AIEditorResult {
  continuity: ContinuityResult | null;
  copyright: CopyrightResult | null;
  suggestedRewrite: string | null;
  error?: string;
}

function clampScore(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Run the full AI editor review for a contribution. Never throws — a failed
 *  review returns partial results with an error note so the story round can
 *  proceed regardless. */
export async function runAiEditor(options: {
  storyTitle: string;
  storyDescription: string;
  storySoFar: string;
  contribution: string;
}): Promise<AIEditorResult> {
  const { storyTitle, storyDescription, storySoFar, contribution } = options;

  const systemPrompt =
    "You are a fiction editor reviewing a chapter contribution for a collaborative " +
    "storytelling platform. Respond ONLY with compact JSON — no markdown, no code fences.";

  const userPrompt = [
    `STORY: ${storyTitle} — ${storyDescription}`,
    storySoFar.trim() ? `STORY SO FAR (ending):\n${storySoFar.slice(-2500)}` : "This is the first contribution.",
    `NEW CONTRIBUTION:\n${contribution.slice(0, 4000)}`,
    "",
    "Return JSON with exactly these keys:",
    '{"continuityScore": <0-100>, "issues": ["<continuity problems, max 5>"], "continuityNotes": "<1-2 sentences>",',
    ' "potentialCopyrightIssue": <true|false>, "copyrightFlags": ["<quoted or suspiciously distinctive phrases>"], "copyrightNotes": "<1 sentence>",',
    ' "suggestedRewrite": "<if continuityScore < 60 or copyright issue: a short improved version, else empty string>"}',
  ].join("\n");

  const response = await callAI({
    prompt: userPrompt,
    systemPrompt,
    maxTokens: 1200,
    temperature: 0.3,
  });

  if (response.error || !response.content.trim()) {
    return {
      continuity: null,
      copyright: null,
      suggestedRewrite: null,
      error: response.error ?? "AI returned empty response",
    };
  }

  // Robust JSON extraction (providers sometimes wrap in prose/fences)
  let parsed: Record<string, unknown> = {};
  const raw = response.content.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : raw;
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return {
      continuity: null,
      copyright: null,
      suggestedRewrite: null,
      error: "AI response was not valid JSON",
    };
  }

  const continuity: ContinuityResult = {
    continuityScore: clampScore(Number(parsed.continuityScore), 70),
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 5) : [],
    notes: typeof parsed.continuityNotes === "string" ? parsed.continuityNotes : "",
  };

  const copyright: CopyrightResult = {
    potentialIssue: parsed.potentialCopyrightIssue === true,
    flags: Array.isArray(parsed.copyrightFlags) ? parsed.copyrightFlags.map(String).slice(0, 5) : [],
    notes: typeof parsed.copyrightNotes === "string" ? parsed.copyrightNotes : "",
  };

  const suggestedRewrite =
    typeof parsed.suggestedRewrite === "string" && parsed.suggestedRewrite.trim().length > 0
      ? parsed.suggestedRewrite
      : null;

  return { continuity, copyright, suggestedRewrite };
}
