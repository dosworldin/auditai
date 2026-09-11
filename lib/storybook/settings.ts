/**
 * Storybook admin-settings resolver (server-side).
 * Falls back to the schema.sql defaults when a setting is missing/corrupt.
 */

import { getSupabaseServer } from "@/lib/db/supabase-server";

export interface StorybookSettings {
  enabled: boolean;
  pdfCredits: number;
  regeneratePageCredits: number;
  defaultPageCount: number;
  minPageCount: number;
  maxPageCount: number;
  photoRetentionDays: number;
  /** "gemini" = direct Gemini image (nano banana) first, Leonardo fallback. */
  imageProvider: "gemini" | "leonardo";
  /** Premium add-on: AI voice narration (Gemini TTS), charged per book. */
  voiceEnabled: boolean;
  voiceCredits: number;
  /** Readymade sample stories (pre-illustrated, no AI calls). */
  samplesEnabled: boolean;
  /** Free public preview: number of pages visible on share links. */
  publicPreviewPages: number;
  /** Paid story-fit analysis (AI) for private stories. */
  analysisCredits: number;
  /** AI story-writer tool (text only, user-provided ideas). */
  aiStoryCredits: number;
  /** Print-on-demand printed copy. */
  podEnabled: boolean;
  podCredits: number;
  podMarkupPercent: number;
}

export const STORYBOOK_DEFAULTS: StorybookSettings = {
  enabled: true,
  pdfCredits: 25,
  regeneratePageCredits: 2,
  defaultPageCount: 10,
  minPageCount: 6,
  maxPageCount: 16,
  photoRetentionDays: 7,
  imageProvider: "gemini",
  voiceEnabled: true,
  voiceCredits: 10,
  samplesEnabled: true,
  publicPreviewPages: 3,
  analysisCredits: 3,
  aiStoryCredits: 2,
  podEnabled: true,
  podCredits: 5,
  podMarkupPercent: 20,
};

function num(v: unknown, fb: number, min = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, n) : fb;
}

export async function getStorybookSettings(): Promise<StorybookSettings> {
  const fallback = { ...STORYBOOK_DEFAULTS };
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("admin_settings")
      .select("key, value")
      .like("key", "storybook_%");

    for (const row of data ?? []) {
      const v = row.value;
      switch (row.key) {
        case "storybook_enabled":
          if (typeof v === "boolean") fallback.enabled = v;
          break;
        case "storybook_pdf_credits":
          fallback.pdfCredits = num(v, fallback.pdfCredits);
          break;
        case "storybook_regenerate_page_credits":
          fallback.regeneratePageCredits = num(v, fallback.regeneratePageCredits);
          break;
        case "storybook_default_page_count":
          fallback.defaultPageCount = num(v, fallback.defaultPageCount, 1);
          break;
        case "storybook_min_page_count":
          fallback.minPageCount = num(v, fallback.minPageCount, 1);
          break;
        case "storybook_max_page_count":
          fallback.maxPageCount = num(v, fallback.maxPageCount, 1);
          break;
        case "storybook_photo_retention_days":
          fallback.photoRetentionDays = num(v, fallback.photoRetentionDays);
          break;
        case "storybook_image_provider":
          if (v === "gemini" || v === "leonardo") fallback.imageProvider = v;
          break;
        case "storybook_voice_enabled":
          if (typeof v === "boolean") fallback.voiceEnabled = v;
          break;
        case "storybook_voice_credits":
          fallback.voiceCredits = num(v, fallback.voiceCredits);
          break;
        case "storybook_samples_enabled":
          if (typeof v === "boolean") fallback.samplesEnabled = v;
          break;
        case "storybook_public_preview_pages":
          fallback.publicPreviewPages = num(v, fallback.publicPreviewPages);
          break;
        case "storybook_analysis_credits":
          fallback.analysisCredits = num(v, fallback.analysisCredits);
          break;
        case "storybook_ai_story_credits":
          fallback.aiStoryCredits = num(v, fallback.aiStoryCredits);
          break;
        case "storybook_pod_enabled":
          if (typeof v === "boolean") fallback.podEnabled = v;
          break;
        case "storybook_pod_credits":
          fallback.podCredits = num(v, fallback.podCredits);
          break;
        case "storybook_pod_markup_percent":
          fallback.podMarkupPercent = num(v, fallback.podMarkupPercent);
          break;
      }
    }
  } catch {
    // DB unreachable — defaults
  }
  return fallback;
}
