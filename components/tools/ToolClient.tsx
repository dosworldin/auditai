"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  CircleDollarSign,
  Clock,
  FileType2,
  Play,
  ScanLine,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import type { ToolDefinition } from "@/lib/types";
import type { AuditReport } from "@/lib/engine/types";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { Badge } from "@/components/ui/Badge";
import { Button, Spinner } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FileUpload } from "@/components/ui/FileUpload";
import type { SelectedFile } from "@/components/ui/FileUpload";
import { Input, Field, Textarea } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/Feedback";
import { ConfigForm, useConfigValues } from "@/components/tools/ConfigForm";
import { ReportHeader, ReportSectionPlaceholder } from "@/components/tools/ReportSkeleton";
import { AuditReportView } from "@/components/tools/AuditReportView";
import { formatUsd } from "@/lib/utils";
import { classifyOcrNeed } from "@/lib/processing/blueprint";

type InputMode = "upload" | "url" | "text";

interface RunStep {
  label: string;
}

const RUN_STEPS: RunStep[] = [
  { label: "Validating input" },
  { label: "Extracting content" },
  { label: "Analyzing document" },
  { label: "Assembling report" },
];

export function ToolClient({ tool }: { tool: ToolDefinition }) {
  const router = useRouter();
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<InputMode>("upload");
  const [values, setValues] = useConfigValues(tool.config);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);

  const hasUrlSupport = tool.inputs.includes("url");
  const hasTextSupport =
    tool.inputs.includes("text") || tool.inputs.includes("markdown");
  const hasUploadSupport = !tool.inputs.every((i) => i === "url" || i === "text");

  const runnableModes = [
    hasUploadSupport ? ("upload" as const) : null,
    hasUrlSupport ? ("url" as const) : null,
    hasTextSupport ? ("text" as const) : null,
  ].filter((m): m is InputMode => m !== null);

  const currentMode = runnableModes.includes(mode) ? mode : (runnableModes[0] ?? "upload");

  const inputReady =
    (currentMode === "upload" && file !== null) ||
    (currentMode === "url" && url.trim().length > 0) ||
    (currentMode === "text" && text.trim().length > 0);

  const requiresOcr =
    currentMode === "upload" && file !== null ? classifyOcrNeed(file.kind) : false;

  const run = async () => {
    if (!inputReady) {
      setError("Please provide a valid input before running the audit.");
      setStatus("error");
      return;
    }
    setError("");
    setReport(null);
    setStatus("running");
    setStep(0);

    const body: Record<string, unknown> = { toolSlug: tool.slug, config: values };

    if (currentMode === "upload" && file?.raw) {
      const buf = await file.raw.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      body.documentName = file.name;
      body.file = { name: file.name, kind: file.kind, base64 };
    } else if (currentMode === "url") {
      body.url = url.trim();
      body.documentName = url.trim();
    } else if (currentMode === "text") {
      body.text = text;
      body.documentName = "Pasted text input";
    }

    setStep(1);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: AuditReport | { error: string } = await res.json();
      setStep(3);
      if (!res.ok) {
        const msg = "error" in data ? data.error : "Audit failed.";
        throw new Error(msg);
      }
      setReport(data as AuditReport);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("error");
    }
  };

  const displayName =
    currentMode === "upload" && file ? file.name : currentMode === "url" ? url : "Past text input";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Provide your input"
            subtitle="Upload a document, enter a URL, or paste text"
            icon={<FileType2 className="h-4 w-4" />}
          />
          <CardContent>
            {runnableModes.length > 1 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {runnableModes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      currentMode === m
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {m === "upload" ? "Upload file" : m === "url" ? "Website / URL" : "Paste text"}
                  </button>
                ))}
              </div>
            ) : null}

            {currentMode === "upload" ? (
              <>
                <FileUpload
                  accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                  allowedKinds={tool.inputs.map((i) => i)}
                  onFileChange={setFile}
                />
                {file ? (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {requiresOcr ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-warning">
                        <ScanLine className="h-3 w-3" /> OCR will be required for this file type
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-success">
                        <Check className="h-3 w-3" /> Direct text extraction (no OCR needed)
                      </span>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {currentMode === "url" ? (
              <Field label="Website URL" help="We will fetch the public page and analyze it.">
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
            ) : null}

            {currentMode === "text" ? (
              <Field label="Paste content" help="Paste or type the content you want audited.">
                <Textarea
                  rows={6}
                  placeholder="Paste your text here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Audit settings"
            subtitle="Configuration schema for this tool (blueprint)"
            icon={<Settings2 className="h-4 w-4" />}
          />
          <CardContent>
            <ConfigForm
              fields={tool.config}
              values={values}
              onChange={setValues}
              loading={status === "running"}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={run} loading={status === "running"} disabled={!inputReady}>
            {status === "running" ? (
              "Running audit..."
            ) : (
              <>
                <Play className="h-4 w-4" /> Run audit
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/tools")}
          >
            Back to tools
          </Button>
          <span className="text-xs text-muted-foreground">
            ~{tool.pricing.creditsPerRun} credit per run - pricing placeholder
          </span>
        </div>

        {status === "running" ? (
          <Card>
            <CardContent className="space-y-4">
              <ProgressBar
                value={((step + 1) / RUN_STEPS.length) * 100}
                label="Processing"
              />
              <ul className="space-y-2">
                {RUN_STEPS.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    {i < step ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : i === step ? (
                      <Spinner className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-border" />
                    )}
                    <span
                      className={
                        i <= step ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {s.label}
                      {i === 1 && requiresOcr ? " (OCR)" : i === 1 ? " (direct extraction)" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {status === "error" ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground animate-fade-in"
            role="alert"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        ) : null}

        {status === "done" ? (
          <div className="space-y-4 animate-fade-in">
            {report ? (
              <AuditReportView report={report} />
            ) : (
              <>
                <ReportHeader
                  toolName={tool.name}
                  documentName={displayName}
                  generatedAt={new Date().toLocaleString()}
                />
                {tool.reportSections.map((section, i) => (
                  <ReportSectionPlaceholder key={section.title} section={section} index={i} />
                ))}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/history")}>
                <Bookmark className="h-4 w-4" /> Save this report
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <ToolIcon icon={tool.icon} accentKey={tool.accent} size="lg" />
              <div>
                <h2 className="font-semibold text-foreground">{tool.name}</h2>
                <p className="text-sm text-muted-foreground">{tool.tagline}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {tool.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="primary">{tool.category}</Badge>
              <Badge tone="neutral">{tool.pricing.tier}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Pricing"
            subtitle="Placeholder - configured in a future phase"
            icon={<CircleDollarSign className="h-4 w-4" />}
          />
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Per run</span>
              <span className="text-2xl font-bold text-foreground">
                {formatUsd(tool.pricing.priceUsd)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium text-foreground">{tool.pricing.tier}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Credits / run</span>
              <span className="font-medium text-foreground">
                {tool.pricing.creditsPerRun}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Est. time</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5" /> ~30 sec
              </span>
            </div>
            {tool.pricing.notes ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {tool.pricing.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium text-foreground">Supported inputs</p>
            <div className="flex flex-wrap gap-2">
              {tool.inputs.map((input) => (
                <Badge key={input} tone="neutral">
                  {input.toUpperCase()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium text-foreground">Report structure</p>
            <ol className="space-y-1.5">
              {tool.reportSections.map((section, i) => (
                <li
                  key={section.title}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {i + 1}
                  </span>
                  {section.title}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => router.push("/history")}>
          <Bookmark className="h-4 w-4" /> Save this tool to favorites
        </Button>
      </div>
    </div>
  );
}
