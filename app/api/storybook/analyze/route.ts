import { NextResponse } from "next/server";
import { requireAuth, deductCredits, addCredits } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { generateText } from "@/lib/ai/provider";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/storybook/analyze — PAID story-fit analysis (AI).
 *
 * Private stories are free to WRITE (the AI story-writer is cheap per run),
 * but analysing whether a story is fit to become an illustrated book /
 * published sample costs storybook_analysis_credits. Returns a structured
 * verdict: age rating, content flags, strengths, risks, and an illustrability
 * score that predicts how well the story will turn into picture-book scenes.
 */

interface AnalysisResult {
  ageRating: string;
  summary: string;
  flags: string[];
  strengths: string[];
  risks: string[];
  illustrationScore: number; // 0-100
  verdict: "fit" | "needs-work" | "not-fit";
  notes: string;
}

function coerce(raw: string): AnalysisResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<AnalysisResult>;
      return {
        ageRating: typeof parsed.ageRating === "string" ? parsed.ageRating : "All ages",
        summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
        flags: Array.isArray(parsed.flags) ? parsed.flags.map(String).slice(0, 10) : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 10) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 10) : [],
        illustrationScore: Math.min(100, Math.max(0, Number(parsed.illustrationScore) || 0)),
        verdict: parsed.verdict === "fit" || parsed.verdict === "needs-work" || parsed.verdict === "not-fit"
          ? parsed.verdict
          : "needs-work",
        notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : "",
      };
    } catch {
      // fall through
    }
  }
  return {
    ageRating: "Unknown",
    summary: raw.slice(0, 500),
    flags: [],
    strengths: [],
    risks: [],
    illustrationScore: 50,
    verdict: "needs-work",
    notes: "The analysis could not be parsed into a structured report.",
  };
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const rl = rateLimit(`story-analyze:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const settings = await getStorybookSettings();

  let body: { title?: unknown; story?: unknown };
  try {
    body = (await request.json()) as { title?: unknown; story?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const story = typeof body.story === "string" ? body.story.trim().slice(0, 20_000) : "";
  if (story.length < 100) {
    return NextResponse.json({ error: "Please provide the full story text (at least 100 characters)." }, { status: 400 });
  }

  // --- Credits ---
  if (user.profile.credits < settings.analysisCredits) {
    return NextResponse.json(
      { error: `Insufficient credits. Required: ${settings.analysisCredits}, Available: ${user.profile.credits}` },
      { status: 402 },
    );
  }
  const deduction = await deductCredits(
    user.id,
    settings.analysisCredits,
    "story_analysis",
    `Story analysis: ${title || "untitled"}`,
    undefined,
    "storybook_analysis",
  );
  if (!deduction.ok) {
    return NextResponse.json({ error: deduction.error ?? "Credit deduction failed" }, { status: 402 });
  }

  try {
    const raw = await generateText(
      `Analyse this story for publication-readiness on a family-friendly storytelling platform.

Title: ${title || "(untitled)"}
Story:
${story}

Judge: age-appropriateness, originality (copyright risk), emotional impact, pacing, and how well it would translate into picture-book illustrations (distinct scenes, visual settings, a clear hero).

Respond with ONLY valid JSON:
{"ageRating":"e.g. All ages / 8+ / Teen","summary":"2-3 sentence verdict","flags":["content concerns, empty if none"],"strengths":["..."],"risks":["..."],"illustrationScore":0-100,"verdict":"fit|needs-work|not-fit","notes":"one practical suggestion"}`,
      {
        systemPrompt:
          "You are a children's publisher's editorial analyst. You are strict, fair and always reply with strict JSON only.",
        temperature: 0.3,
        maxTokens: 1200,
      },
    );

    const analysis = coerce(raw);

    // Persist for the user's history (best-effort).
    try {
      const supabase = await getSupabaseServer();
      await (supabase as any).from("storybook_analyses").insert({
        user_id: user.id,
        title: title || null,
        result: analysis,
        words: story.split(/\s+/).length,
      });
    } catch {
      // Table may not exist yet — non-fatal.
    }

    return NextResponse.json({ analysis, creditsSpent: settings.analysisCredits });
  } catch (err) {
    await addCredits(
      user.id,
      settings.analysisCredits,
      "story_analysis_refund",
      "Refund: story analysis failed",
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 502 },
    );
  }
}
