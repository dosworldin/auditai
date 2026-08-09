import { NextResponse } from "next/server";
import type { AuditRunPayload } from "@/lib/engine/types";
import { runAudit } from "@/lib/engine/pipeline";
import { getToolLogic } from "@/lib/engine/toolLogic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validatePayload(body: unknown): { ok: true; payload: AuditRunPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const toolSlug = typeof b.toolSlug === "string" ? b.toolSlug.trim() : "";
  if (!toolSlug) return { ok: false, error: "toolSlug is required" };
  if (!getToolLogic(toolSlug)) {
    return { ok: false, error: `Unknown tool: ${toolSlug}` };
  }
  const file = b.file;
  if (file && (typeof file !== "object" || file === null)) {
    return { ok: false, error: "file must be an object" };
  }
  const url = typeof b.url === "string" ? b.url : undefined;
  const text = typeof b.text === "string" ? b.text : undefined;
  const documentName = typeof b.documentName === "string" ? b.documentName : undefined;
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

  const payload: AuditRunPayload = { toolSlug, documentName, url, text, config };
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

  const report = await runAudit(validated.payload);
  const statusCode = report.status === "ok" ? 200 : 404;
  return NextResponse.json(report, { status: statusCode });
}
