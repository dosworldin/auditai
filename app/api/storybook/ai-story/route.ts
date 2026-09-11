import { NextResponse } from "next/server";
import { requireAuth, deductCredits, addCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { generateText } from "@/lib/ai/provider";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/storybook/ai-story — AI story-writer tool.
 *
 * A form-wizard endpoint: the user fills in rules (hero, world, tone, words,
 * language) and the AI writes the story text RIGHT HERE — no images, no photo,
 * just the story. Costs storybook_ai_story_credits per run.
 *
 * Strict "safe for every reader" rules are baked into the system prompt.
 */

const LANGUAGES: Record<string, string> = {
  en: "simple English",
  hi: "simple Hindi (Devanagari script)",
  es: "simple Spanish",
};

const TONES: Record<string, string> = {
  warm: "warm and heart-warming",
  funny: "light-hearted and funny",
  adventurous: "exciting and adventurous",
  calm: "calm and soothing (perfect for bedtime)",
  mysterious: "gently mysterious with a satisfying reveal",
};

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`ai-story:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const settings = await getStorybookSettings();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const str = (k: string, max = 300): string =>
    typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "";
  const pick = (map: Record<string, string>, v: string, fb: string): string => map[v] ?? map[fb];

  const hero = str("hero", 60);
  const world = str("world", 300);
  const problem = str("problem", 300);
  const tone = pick(TONES, str("tone", 20), "warm");
  const language = pick(LANGUAGES, str("language", 10), "en");
  const words = Math.min(800, Math.max(80, Number(body.words) || 250));

  if (!hero) {
    return NextResponse.json({ error: "Tell us who the story is about (hero is required)." }, { status: 400 });
  }

  // --- Credits ---
  if (user.profile.credits < settings.aiStoryCredits) {
    return NextResponse.json(
      { error: `Insufficient credits. Required: ${settings.aiStoryCredits}, Available: ${user.profile.credits}` },
      { status: 402 },
    );
  }
  const deduction = await deductCredits(
    user.id,
    settings.aiStoryCredits,
    "ai_story_write",
    `AI story: ${hero}`,
    undefined,
    "storybook_ai_story",
  );
  if (!deduction.ok) {
    return NextResponse.json({ error: deduction.error ?? "Credit deduction failed" }, { status: 402 });
  }

  const prompt = `Write a complete short story.

Hero: ${hero}
${world ? `Setting/world: ${world}` : ""}
${problem ? `Goal or problem: ${problem}` : ""}
Tone: ${tone}
Length: about ${words} words
Language: ${language}

STRICT SAFETY + QUALITY RULES:
- Suitable for ALL ages: no violence, no scary content, no romance, no profanity, no real brands or celebrities.
- Keep names, places and events fictional and original (no copyrighted characters).
- A clear beginning, middle and end — the hero grows or learns something.
- Vivid but simple language; short paragraphs.

Respond with the story text only (a short title on the first line starting with "#", then the story).`;

  try {
    const raw = await generateText(prompt, {
      systemPrompt:
        "You are a master storyteller who writes safe, original, age-friendly stories. You follow length and language instructions exactly.",
      temperature: 0.8,
      maxTokens: Math.min(4096, 400 + words * 3),
    });

    const content = raw.trim();
    if (!content) throw new Error("The AI returned an empty story. Please try again.");

    const titleMatch = content.match(/^#\s*(.+)$/m);
    const title = (titleMatch?.[1] ?? hero).trim().slice(0, 120);
    const storyText = (titleMatch ? content.replace(titleMatch[0], "").trim() : content).slice(0, 20_000);

    // Persist for the user's history (best-effort).
    try {
      const supabase = await getSupabaseServer();
      await (supabase as any).from("storybook_ai_stories").insert({
        user_id: user.id,
        title,
        content: storyText,
        words: storyText.split(/\s+/).length,
        language: str("language", 10) || "en",
        provider: null,
      });
    } catch {
      // Table may not exist yet — non-fatal.
    }

    return NextResponse.json({ title, story: storyText, creditsSpent: settings.aiStoryCredits });
  } catch (err) {
    await addCredits(
      user.id,
      settings.aiStoryCredits,
      "ai_story_write_refund",
      "Refund: AI story generation failed",
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Story generation failed" },
      { status: 502 },
    );
  }
}
