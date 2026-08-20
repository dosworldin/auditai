import { NextResponse } from "next/server";
import { TOOL_COUNT } from "@/lib/tools/registry";
import { LAB_COUNT } from "@/lib/labs/registry";
import { TOOL_LOGIC } from "@/lib/engine/toolLogic";
import { ANALYZERS } from "@/lib/engine/analyzers";

export const dynamic = "force-dynamic";

export function GET() {
  const aiConfigured = Boolean(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return NextResponse.json({
    name: "auditai-platform",
    version: "1.0.0",
    status: "ok",
    modules: {
      tools: TOOL_COUNT,
      labs: LAB_COUNT,
    },
    infrastructure: {
      database: supabaseConfigured ? "connected" : "not_configured",
      ai: aiConfigured ? "configured" : "not_configured",
      auth: supabaseConfigured ? "enabled" : "disabled",
      ocr: "tesseract_on_demand",
      queue: "none_synchronous",
    },
    ai: {
      primary: process.env.AI_PRIMARY_PROVIDER || "deepseek",
      fallback: process.env.AI_FALLBACK_PROVIDER || "gemini",
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
    processing: {
      bullmq: false,
      backgroundWorkers: 0,
      ocrOnDemandOnly: true,
    },
    logic: {
      toolLogicEntries: Object.keys(TOOL_LOGIC).length,
      customAnalyzers: Object.keys(ANALYZERS).length,
      reportPipeline: "live",
      labsPipeline: "live",
    },
    message: supabaseConfigured
      ? "Full platform ready. AI integration available with configured API keys."
      : "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to enable database. Add DEEPSEEK_API_KEY or GEMINI_API_KEY for AI features.",
  });
}
