"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import type { LabDefinition } from "@/lib/types";
import type { LabOutput } from "@/lib/engine/types";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FileUpload } from "@/components/ui/FileUpload";
import type { SelectedFile } from "@/components/ui/FileUpload";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ConfigForm, useConfigValues } from "@/components/tools/ConfigForm";
import { ProgressBar } from "@/components/ui/Feedback";
import { LabOutputView } from "@/components/labs/LabOutputView";

type LabMode = "upload" | "text" | "url";

export function LabClient({ lab }: { lab: LabDefinition }) {
  const router = useRouter();
  const [mode, setMode] = useState<LabMode>("upload");
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [values, setValues] = useConfigValues(lab.config);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<LabOutput | null>(null);

  const hasUrl = lab.inputs.includes("url");
  const hasText = lab.inputs.includes("text") || lab.inputs.includes("markdown");

  const inputReady =
    (mode === "upload" && file !== null) ||
    (mode === "url" && url.trim().length > 0) ||
    (mode === "text" && text.trim().length > 0);

  const run = async () => {
    if (!inputReady) {
      setError("Please provide an input before running the experiment.");
      return;
    }
    setError("");
    setOutput(null);
    setRunning(true);

    const body: Record<string, unknown> = { labSlug: lab.slug, config: values };

    if (mode === "upload" && file?.raw) {
      const buf = await file.raw.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      body.file = { name: file.name, kind: file.kind, base64: btoa(binary) };
    } else if (mode === "url") {
      body.url = url.trim();
    } else if (mode === "text") {
      body.text = text;
    }

    try {
      const res = await fetch("/api/labs/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: LabOutput | { error: string } = await res.json();
      if (!res.ok) {
        const msg = "error" in data ? data.error : "Lab run failed.";
        throw new Error(msg);
      }
      setOutput(data as LabOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Input"
            subtitle="Provide the experiment with content"
          />
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "upload" as const, label: "Upload file" },
                { id: "url" as const, label: "Website / URL" },
                { id: "text" as const, label: "Paste text" },
              ]
                .filter((m) => m.id !== "url" || hasUrl)
                .filter((m) => m.id !== "text" || hasText)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      mode === m.id
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
            </div>

            {mode === "upload" ? (
              <FileUpload
                accept=".pdf,.docx,.txt,.csv,.png,.jpg"
                allowedKinds={lab.inputs.map((i) => i)}
                onFileChange={setFile}
              />
            ) : null}
            {mode === "url" ? (
              <Field label="Website URL">
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
            ) : null}
            {mode === "text" ? (
              <Field label="Paste content">
                <Textarea
                  rows={6}
                  placeholder="Paste your content here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Configuration" subtitle="Placeholder configuration for this experiment" />
          <CardContent>
            <ConfigForm
              fields={lab.config}
              values={values}
              onChange={setValues}
              loading={running}
            />
          </CardContent>
        </Card>

        <Button size="lg" onClick={run} loading={running} disabled={!inputReady}>
          <Play className="h-4 w-4" /> Run experiment
        </Button>

        {error ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground animate-fade-in"
            role="alert"
          >
            <span>{error}</span>
          </div>
        ) : null}

        {running ? (
          <Card>
            <CardContent>
              <ProgressBar value={35} label="Running experiment" />
            </CardContent>
          </Card>
        ) : null}

        {output ? (
          <Card className="animate-fade-in">
            <CardHeader title="Experiment output" subtitle="Isolated lab result" />
            <CardContent>
              <LabOutputView output={output} />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => router.push("/labs")}>
                  Back to Labs
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <ToolIcon icon={lab.icon} accentKey={lab.accent} size="lg" />
              <div>
                <h2 className="font-semibold text-foreground">{lab.name}</h2>
                <p className="text-sm text-muted-foreground">{lab.category}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {lab.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge
                tone={lab.status === "Beta" ? "info" : "warning"}
              >
                {lab.status}
              </Badge>
              <Badge tone="neutral">{lab.category}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-medium text-foreground">
              Supported inputs
            </p>
            <div className="flex flex-wrap gap-2">
              {lab.inputs.map((input) => (
                <Badge key={input} tone="neutral">
                  {input.toUpperCase()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Experiments disclaimer</p>
            <p className="mt-2">
              Labs are experimental. Behavior may change or break without
              notice, and results are not guaranteed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
