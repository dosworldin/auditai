/**
 * Storybook story generator — uses the admin-configured AI provider chain
 * (lib/ai/provider.ts, DeepSeek→Gemini failover) to produce a structured,
 * age-appropriate children's story: one scene per page + illustrator prompt.
 */

import { generateText } from "@/lib/ai/provider";

export interface StoryPageInput {
  pageNumber: number;
  /** Child-facing story text for this page. */
  text: string;
  /** Scene description for the illustrator — includes the child character. */
  illustrationPrompt: string;
}

export interface StoryResult {
  title: string;
  pages: StoryPageInput[];
}

const ART_STYLE_PROMPTS: Record<string, string> = {
  watercolor:
    "soft watercolor children's book illustration, gentle washes, warm palette",
  cartoon:
    "vibrant flat cartoon illustration, bold outlines, cheerful and playful",
  "pixar3d":
    "polished 3D animated movie style, soft lighting, big expressive eyes, Pixar-like render",
  storybook:
    "classic storybook ink-and-gouache illustration, whimsical, detailed backgrounds",
};

export function artStylePrompt(style: string): string {
  return ART_STYLE_PROMPTS[style] ?? ART_STYLE_PROMPTS.watercolor;
}

const THEMES: Record<string, string> = {
  adventure: "a brave adventure with a gentle challenge that gets solved",
  friendship: "making a new friend and learning to share and trust",
  space: "a trip to space, visiting planets and stars and coming home safe",
  animals: "a day spent helping friendly animals in a magical forest",
  underwater: "an underwater journey with kind sea creatures",
  magic: "discovering a small magic that changes an ordinary day",
  bedtime: "a calming bedtime journey through a sleepy, dreamy world",
};

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

interface RawPage {
  text?: unknown;
  illustration?: unknown;
}

function coercePages(raw: unknown, pageCount: number): StoryPageInput[] | null {
  if (!Array.isArray(raw)) return null;
  const pages: StoryPageInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as RawPage;
    const text = typeof item?.text === "string" ? item.text.trim() : "";
    const ill = typeof item?.illustration === "string" ? item.illustration.trim() : "";
    if (!text || !ill) return null;
    pages.push({
      pageNumber: i + 1,
      text: text.slice(0, 600),
      illustrationPrompt: ill.slice(0, 600),
    });
  }
  return pages.length === pageCount ? pages : null;
}

function extractJson(content: string): unknown | null {
  // Model output may include fences or prose — find the outermost object.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateStory(options: {
  childName: string;
  age: number | null;
  gender: string;
  theme: string;
  language: string;
  pageCount: number;
  storyIdea: string | null;
}): Promise<StoryResult> {
  const { childName, age, gender, theme, language, pageCount, storyIdea } = options;

  const ageBand =
    age == null ? "4-8" : age <= 5 ? "3-5" : age <= 8 ? "6-8" : "9-12";
  const pronoun =
    gender === "boy" ? "he" : gender === "girl" ? "she" : "they";
  const themeText = THEMES[theme] ?? THEMES.adventure;

  const languageLine =
    language === "hi"
      ? "Write the story text in simple Hindi (Devanagari script)."
      : language === "es"
        ? "Write the story text in simple Spanish."
        : "Write the story text in simple English.";

  const ideaLine = storyIdea?.trim()
    ? `The parent suggested this idea — weave it in naturally: "${esc(storyIdea.slice(0, 300))}".`
    : "";

  const prompt = `Create a ${pageCount}-page children's picture book for a child named ${childName} (age band ${ageBand}; the main character is "${childName}", ${pronoun} is the hero of every scene).

Theme: ${themeText}. ${ideaLine}
${languageLine}

STRICT RULES:
- ${pageCount} pages exactly. Each page: 2-4 simple sentences, read-aloud rhythm, age ${ageBand} vocabulary.
- Page 1 introduces ${childName}; the last page ends warmly (home, sleep, or celebration).
- NEVER describe ${childName}'s specific appearance (no hair/eye/skin details) — the illustrator uses a reference photo for likeness. Refer to the hero only as ${childName}.
- The "illustration" field is a scene description for an illustrator: setting, action, mood, supporting characters/creatures, props, time of day. Always include ${childName} as the main subject, but describe appearance only generically ("a young child in a yellow raincoat").

Respond with ONLY valid JSON, no markdown fences:
{"title":"...","pages":[{"text":"...","illustration":"..."}]}`;

  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generateText(prompt, {
      systemPrompt:
        "You are an award-winning children's book author and art director. You always reply with strict JSON only.",
      temperature: attempt === 0 ? 0.8 : 0.5,
      maxTokens: Math.min(4096, 700 + pageCount * 260),
    });

    const parsed = extractJson(raw) as { title?: unknown; pages?: unknown } | null;
    const pages = parsed ? coercePages(parsed.pages, pageCount) : null;
    if (pages && typeof parsed?.title === "string" && parsed.title.trim()) {
      return { title: parsed.title.trim().slice(0, 120), pages };
    }
    lastErr = parsed ? "page structure mismatch" : "unparseable JSON";
  }

  throw new Error(`Story generation failed after retries (${lastErr ?? "unknown"})`);
}
