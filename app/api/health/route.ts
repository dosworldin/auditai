import { NextResponse } from "next/server";
import { TOOL_COUNT } from "@/lib/tools/registry";
import { LAB_COUNT } from "@/lib/labs/registry";
import { TOOL_LOGIC } from "@/lib/engine/toolLogic";
import { ANALYZERS } from "@/lib/engine/analyzers";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    name: "auditai-platform",
    phase: "logic-v1",
    status: "ok",
    modules: {
      tools: TOOL_COUNT,
      labs: LAB_COUNT,
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
    message:
      "TOOLS-LOGIC-1 phase - real analysis logic is live for tools and labs. Payments, billing, auth, and history persistence remain for later phases.",
  });
}
