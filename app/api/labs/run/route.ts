import { NextResponse } from "next/server";
import type { LabRunPayload } from "@/lib/engine/types";
import { runLab } from "@/lib/engine/labLogic";
import { getLab } from "@/lib/labs/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validatePayload(body: unknown): { ok: true; payload: LabRunPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const labSlug = typeof b.labSlug === "string" ? b.labSlug.trim() : "";
  if (!labSlug) return { ok: false, error: "labSlug is required" };
  if (!getLab(labSlug)) {
    return { ok: false, error: `Unknown lab: ${labSlug}` };
  }
  const file = b.file;
  if (file && (typeof file !== "object" || file === null)) {
    return { ok: false, error: "file must be an object" };
  }
  const url = typeof b.url === "string" ? b.url : undefined;
  const text = typeof b.text === "string" ? b.text : undefined;
  const config =
    b.config && typeof b.config === "object" && !Array.isArray(b.config)
      ? (b.config as Record<string, string | number | boolean>)
      : undefined;

  const hasFile = file !== undefined;
  const hasUrl = Boolean(url && url.trim());
  const hasText = Boolean(text && text.trim());
  if (!hasFile && !hasUrl && !hasText) {
    return { ok: false, error: "Provide one of: file, url, or text" };
  }

  const payload: LabRunPayload = { labSlug, url, text, config };
  if (hasFile) {
    const f = file as Record<string, unknown>;
    if (typeof f.name !== "string" || typeof f.kind !== "string" || typeof f.base64 !== "string") {
      return { ok: false, error: "file must include name, kind, and base64" };
    }
    payload.file = { name: f.name, kind: f.kind, base64: f.base64 };
  }
  return { ok: true, payload };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validatePayload(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const output = await runLab(validated.payload);
  return NextResponse.json(output, { status: 200 });
}
