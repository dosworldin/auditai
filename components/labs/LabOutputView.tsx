"use client";

import { FlaskConical, Info, ShieldCheck } from "lucide-react";
import type { LabOutput } from "@/lib/engine/types";
import { Badge } from "@/components/ui/Badge";

const statusTone: Record<string, "info" | "warning" | "success" | "neutral"> = {
  EXPERIMENTAL: "warning",
  BETA: "info",
  ACTIVE: "success",
  DISABLED: "neutral",
  ARCHIVED: "neutral",
};

export function LabOutputView({ output }: { output: LabOutput }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Lab experiment output - {output.version}
            </p>
            <h2 className="mt-1 text-lg font-bold text-foreground">{output.labName}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Generated {new Date(output.generatedAt).toLocaleString()} - input: {output.inputType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[output.status] ?? "neutral"}>{output.status}</Badge>
            <Badge tone="success">isolated</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{output.summary}</p>
      </div>

      {Object.keys(output.metrics).length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Metrics
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(output.metrics).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/50 p-3">
                <dt className="truncate text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">
          Findings ({output.findings.length})
        </h3>
        {output.findings.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No findings were produced.
          </p>
        ) : (
          output.findings.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[f.severity] ?? "neutral"}>{f.severity}</Badge>
                <span className="text-xs text-muted-foreground">
                  {Math.round(f.confidence * 100)}% confidence
                </span>
              </div>
              <h4 className="mt-2 font-semibold text-foreground">{f.label}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
              {f.evidence ? (
                <blockquote className="mt-3 rounded-lg border-l-2 border-border bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
                  &ldquo;{f.evidence.slice(0, 280)}
                  {f.evidence.length > 280 ? "..." : ""}&rdquo;
                </blockquote>
              ) : null}
            </div>
          ))
        )}
      </div>

      {output.notes.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </h3>
          </div>
          <ul className="mt-3 space-y-1.5">
            {output.notes.map((n, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                - {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Isolation: {output.disclaimer}
        </span>
      </div>
    </div>
  );
}
