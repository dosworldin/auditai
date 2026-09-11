/**
 * Storybook voice narration — Google Gemini TTS (gemini-2.5-flash-preview-tts),
 * a DIRECT provider using the existing GEMINI_API_KEY. One warm narration
 * audio track per story page, stored in the private storybook bucket.
 *
 * Output: PCM 24kHz 16-bit mono → wrapped in a minimal WAV header so browsers
 * can play it with a plain <audio> element.
 */

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24_000;

export type NarrationVoice =
  | "Kore" | "Puck" | "Charon" | "Fenrir" | "Aoede" | "Leda" | "Orus" | "Zephyr";

const VOICE_PROMPTS: Record<string, string> = {
  Kore: "Warm, friendly female storyteller. Clear, unhurried, bedtime-story calm.",
  Puck: "Bright, playful and bouncy — like a fun kids' show host.",
  Charon: "Deep, cozy grandfather storyteller voice.",
  Fenrir: "Energetic, adventurous narrator with lively pacing.",
  Aoede: "Gentle, melodic storyteller — soft and soothing.",
  Leda: "Youthful, clear female narrator — light and airy.",
  Orus: "Confident, classic audiobook narrator voice.",
  Zephyr: "Cheerful, breezy narrator — light and quick.",
};

export interface NarratePageResult {
  wav: Buffer;
  provider: "gemini_tts";
}

function baseName(voice: string): string {
  return (VOICE_PROMPTS[voice] ?? VOICE_PROMPTS.Kore).split(",")[0];
}

/** Wrap raw 16-bit PCM mono into a RIFF/WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Generate one narration track. Returns WAV bytes. */
export async function narratePage(text: string, voice: string): Promise<NarratePageResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured (required for voice narration)");
  if (!text.trim()) throw new Error("Narration: empty page text");

  const style = VOICE_PROMPTS[voice] ?? VOICE_PROMPTS.Kore;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${baseName(voice)} narration: ${style} Read the following story page aloud. ${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.timeout(110_000),
    },
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini TTS API ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const b64 = p.inlineData?.data;
    if (b64) return { wav: pcmToWav(Buffer.from(b64, "base64")), provider: "gemini_tts" };
  }
  throw new Error("Gemini TTS returned no audio");
}

export { TTS_MODEL, VOICE_PROMPTS };
