/**
 * Central language handling for AI output.
 *
 * Used by:
 *  - lib/ai/semantic.ts (Audit Tools AI semantic layer — all 63 tools)
 *  - lib/ai/dreamAI.ts  (Dream AI Analyzer sufficiency + interpretation)
 *  - lib/engine/labLogic.ts (runLab — localizes the four true Labs when the
 *    user selects a non-English output language)
 *
 * Rules:
 *  - "auto" / English input → English output (default, zero behavior change).
 *  - A user-selected language always wins when it is not English.
 *  - If the user selected English but wrote in Hindi/Hinglish (or other
 *    supported languages), the answer follows the input language.
 *  - Hinglish = romanized Hindi-English mix ("kya haal hai", "yaar", etc.) —
 *    NOT Devanagari; Devanagari text resolves to plain Hindi ("hi").
 *
 * Server-side only: localization calls the AI provider chain.
 */

import { callAI } from "@/lib/ai/provider";

export interface LanguageDef {
  code: string;
  name: string;
  /** Instruction appended to AI system prompts. */
  instruction: string;
}

export const LANGUAGES: Record<string, LanguageDef> = {
  en: { code: "en", name: "English", instruction: "" },
  hi: {
    code: "hi",
    name: "Hindi",
    instruction:
      "Write ALL user-facing text (titles, explanations, evidence context, recommendations, summaries, notes) in clear, simple HINDI using Devanagari script. Keep proper nouns, product names and technical identifiers (slugs, code, URLs) as-is.",
  },
  hinglish: {
    code: "hinglish",
    name: "Hinglish",
    instruction:
      "Write ALL user-facing text in natural HINGLISH — the casual Hindi-English mix written in Roman script that Indians use in chat (e.g. \"Yeh clause aapke against ja sakta hai, isliye isko change karwao\"). Hindi grammar and connectives in Roman script with common English words left in English; do NOT use Devanagari. Keep proper nouns, product names and technical identifiers as-is.",
  },
  es: {
    code: "es",
    name: "Spanish",
    instruction:
      "Write ALL user-facing text in clear SPANISH. Keep proper nouns, product names and technical identifiers as-is.",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    instruction:
      "Write ALL user-facing text in clear PORTUGUESE. Keep proper nouns, product names and technical identifiers as-is.",
  },
  fr: {
    code: "fr",
    name: "French",
    instruction:
      "Write ALL user-facing text in clear FRENCH. Keep proper nouns, product names and technical identifiers as-is.",
  },
  de: {
    code: "de",
    name: "German",
    instruction:
      "Write ALL user-facing text in clear GERMAN. Keep proper nouns, product names and technical identifiers as-is.",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    instruction:
      "Write ALL user-facing text in clear MODERN STANDARD ARABIC. Keep proper nouns, product names and technical identifiers as-is.",
  },
  bn: {
    code: "bn",
    name: "Bengali",
    instruction:
      "Write ALL user-facing text in clear, simple BENGALI. Keep proper nouns, product names and technical identifiers as-is.",
  },
  ru: {
    code: "ru",
    name: "Russian",
    instruction:
      "Write ALL user-facing text in clear RUSSIAN. Keep proper nouns, product names and technical identifiers as-is.",
  },
  ur: {
    code: "ur",
    name: "Urdu",
    instruction:
      "Write ALL user-facing text in clear, simple URDU. Keep proper nouns, product names and technical identifiers as-is.",
  },
  ta: {
    code: "ta",
    name: "Tamil",
    instruction:
      "Write ALL user-facing text in clear, simple TAMIL. Keep proper nouns, product names and regional technical terms as-is.",
  },
  mr: {
    code: "mr",
    name: "Marathi",
    instruction:
      "Write ALL user-facing text in clear, simple MARATHI. Keep proper nouns, product names and technical identifiers as-is.",
  },
  id: {
    code: "id",
    name: "Indonesian",
    instruction:
      "Write ALL user-facing text in clear INDONESIAN (Bahasa Indonesia). Keep proper nouns, product names and technical identifiers as-is.",
  },
  ja: {
    code: "ja",
    name: "Japanese",
    instruction:
      "Write ALL user-facing text in clear JAPANESE. Keep proper nouns, product names and technical identifiers as-is.",
  },
  ko: {
    code: "ko",
    name: "Korean",
    instruction:
      "Write ALL user-facing text in clear KOREAN. Keep proper nouns, product names and technical identifiers as-is.",
  },
  zh: {
    code: "zh",
    name: "Chinese",
    instruction:
      "Write ALL user-facing text in clear SIMPLIFIED CHINESE. Keep proper nouns, product names and technical identifiers as-is.",
  },
};

/** Distinct Devanagari code points indicate plain Hindi (or Marathi —
 * both use Devanagari; resolveLanguage's explicit selection disambiguates). */
function looksDevanagari(text: string): boolean {
  const devanagari = (text.match(/[\u0900-\u097F]/g) ?? []).length;
  return devanagari >= Math.max(8, text.length * 0.02);
}

/** Common romanized Hindi/Hinglish words that signal a Hinglish text. */
const HINGLISH_MARKERS = [
  " kya", "kyu", "kyun", "nahi", " hai", " hain", "hoon", "hoga", "hogaya",
  "mujhe", "mera", "meri", "tumhara", "apna", "acha", "accha", "theek",
  "yaar", "bhai", " matlab ", " samajh", "batao", "karo", "karna", "kar diya",
  "chahiye", "sakta", "sakte", "wala", "wali", "jaldi", "abhi", " kal ",
  "paisa", "paise", "kaam", "baat", "kitna", "bahut", "bohot", "thoda",
  "raha", "rahi", "rahe", "hota", "hoti", "hote", "gaya", "gayi", "gayee",
  "diya", "wapas", "phir", "lena", "dena", "karke", "karke", "kuch", "koi",
];

/** Non-Latin script detection: the dominant script decides the language. */
function detectByScript(text: string): string | null {
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  const samples: [RegExp, string][] = [
    [/[\u0400-\u04FF]/g, "ru"], // Cyrillic → Russian
    [/[\u0600-\u06FF\u0750-\u077F]/g, "ar"], // Arabic script → Arabic (covers Urdu chars; selection refines)
    [/[\u0980-\u09FF]/g, "bn"], // Bengali-Assamese
    [/[\u0B80-\u0BFF]/g, "ta"], // Tamil
    [/[\u3040-\u30FF]/g, "ja"], // Hiragana/Katakana
    [/[\uAC00-\uD7AF]/g, "ko"], // Hangul
    [/[\u4E00-\u9FFF]/g, "zh"], // CJK ideographs
  ];
  for (const [re, lang] of samples) {
    if (count(re) >= Math.max(4, text.length * 0.02)) return lang;
  }
  return null;
}

/**
 * Best-effort heuristic language detection for "auto" behavior.
 *
 * Conservative by design: scripts we can identify reliably (Devanagari,
 * Cyrillic, Arabic, Bengali, Tamil, Japanese, Korean, Chinese) and romanized
 * Hindi/Hinglish are detected; other Latin-script languages (Spanish,
 * Portuguese, French, German, Indonesian, ...) return "en" and are handled
 * by the mirror rule — the AI matches the input language it actually sees,
 * which is far safer than guessing between similar Latin languages.
 */
export function detectLanguage(text: string): string {
  if (!text || text.length < 8) return "en";
  if (looksDevanagari(text)) return "hi";
  const scriptLang = detectByScript(text);
  if (scriptLang) return scriptLang;
  const low = ` ${text.toLowerCase()} `;
  const hits = HINGLISH_MARKERS.filter((m) => low.includes(m)).length;
  if (hits >= 3) return "hinglish";
  return "en";
}

/** True when the resolved language should NOT be forced onto the output. */
export function isEnglish(code: string): boolean {
  return code === "en" || !(code in LANGUAGES);
}

/**
 * Shared "mirror the user's language" instruction for auto/English runs:
 * the answer follows the language the user wrote in. Used by the semantic
 * layer (all audit tools) and the dream analyzer. Language-specific mirror
 * wording stays generic so any supported language works, not just a fixed
 * list — the model matches the input text it actually receives.
 */
export const AUTO_MIRROR_RULE =
  "LANGUAGE: Answer in the SAME language and script the user wrote in. Match their style exactly — Hindi in Devanagari stays Devanagari; Hindi or the Hindi-English mix (Hinglish) written in Roman letters stays Roman-script Hinglish and must NEVER be converted to Devanagari; Spanish stays Spanish; any other language exactly as the user used it. Only fall back to English if the language truly cannot be determined.";

/**
 * Resolve the output language for a run.
 *
 * Precedence:
 *  1. User selected a non-English language in config → that language wins.
 *  2. Otherwise auto-detect from the input text (so Hindi/Hinglish input gets
 *     Hindi/Hinglish output even with the default English selection).
 */
export function resolveLanguage(configLanguage: unknown, inputText?: string): string {
  const selected = typeof configLanguage === "string" ? configLanguage.toLowerCase() : "";
  if (selected && selected !== "en" && selected in LANGUAGES) return selected;
  return inputText ? detectLanguage(inputText) : "en";
}

/**
 * The AI system-prompt fragment for a language ("" for English — no extra
 * tokens, no behavior change when everything stays English).
 */
export function languageInstruction(code: string): string {
  return LANGUAGES[code]?.instruction ?? "";
}

/** Human-readable name for notices/labels. */
export function languageName(code: string): string {
  return LANGUAGES[code]?.name ?? "English";
}

/* ------------------------------------------------------------------ */
/*  Lab output localization (true Labs only)                           */
/* ------------------------------------------------------------------ */

interface LocalizableFinding {
  label: string;
  detail: string;
  evidence?: string;
  /** Generative copy users send onward (exit scripts, rewritten messages).
   * Localized too — unlike evidence quotes, this is authored copy. */
  copiableText?: string;
}

const LOCALIZE_SYSTEM = `You translate/localize AI-tool outputs for a multilingual consumer product.

Input: JSON with the original English output.
Task: return ONLY a JSON object with the SAME shape and keys, with every user-facing string (summary, notes entries, finding label/detail text, and any "copiableText" the user will copy and send) rewritten in the requested language. Preserve the meaning and tone exactly — humorous stays humorous, warnings stay warnings. Do NOT add or remove findings or change any metric numbers. Keep product names, technical identifiers, slugs, URLs and code as-is. "evidence" contains verbatim quotes from the source material: translate the wording so it reads naturally, but keep names and figures unchanged. Never answer with anything except the JSON object.
If no explicit language instruction is present, rewrite in the SAME language as the source material — Hindi stays Hindi, Hindi or the Hindi-English mix (Hinglish) written in Roman letters stays in that form, Spanish stays Spanish, any other language stays as written; fall back to English only if the language cannot be determined.`;

function clipJson(text: string, max = 12_000): string {
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text;
}

/**
 * Rewrite a LabOutput's user-facing English strings into the requested
 * language with one AI call. Findings keep their type and every non-textual
 * field (id, severity, confidence, copiableText, etc.) is preserved. Throws
 * on AI failure so the route can refund credits and show a proper error
 * (no half-translated fake result).
 */
export async function localizeLabOutput<T extends LocalizableFinding>(
  output: {
    summary: string;
    metrics: Record<string, string | number>;
    findings: T[];
    notes: string[];
  },
  language: string,
): Promise<{ summary: string; findings: T[]; notes: string[] }> {
  const instruction = languageInstruction(language);
  if (!instruction) return output;

  const payload = {
    summary: output.summary,
    findings: output.findings.map((f) => ({
      label: f.label,
      detail: f.detail,
      ...(f.evidence ? { evidence: f.evidence } : {}),
      ...(f.copiableText ? { copiableText: f.copiableText } : {}),
    })),
    notes: output.notes,
  };

  const response = await callAI({
    systemPrompt: `${LOCALIZE_SYSTEM}\n\n${instruction}`,
    prompt: `Localize this lab output (metrics are metadata — do not include them in the response):\n${clipJson(JSON.stringify(payload))}\n\nReturn the localized JSON object with keys "summary", "findings" (same array order, same fields incl. any "evidence") and "notes".`,
    temperature: 0.2,
    maxTokens: 2400,
  });

  if (response.error || !response.content.trim()) {
    throw new Error(
      response.error ??
        "The AI service did not return a response. Please try again in a moment.",
    );
  }

  const fenced = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : response.content).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("The AI returned an unreadable response. Please try again.");
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error("The AI returned an unreadable response. Please try again.");
  }

  const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : output.summary;
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.map(String).filter((n) => n.trim().length > 0)
    : output.notes;

  // Match localized findings back onto the originals by index so ids,
  // severities, confidences, copiable text etc. are preserved untouched.
  const localized = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings = output.findings.map((f, i) => {
    const l = typeof localized[i] === "object" && localized[i] !== null ? (localized[i] as Record<string, unknown>) : null;
    const pickText = (v: unknown, fallback: string) =>
      typeof v === "string" && v.trim() ? v.trim() : fallback;
    return {
      ...f,
      label: l ? pickText(l.label, f.label) : f.label,
      detail: l ? pickText(l.detail, f.detail) : f.detail,
      evidence: l ? pickText(l.evidence, f.evidence ?? "") || undefined : f.evidence,
      copiableText: l ? pickText(l.copiableText, f.copiableText ?? "") || undefined : f.copiableText,
    };
  });

  return { summary, findings, notes };
}
