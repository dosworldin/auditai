"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gauge,
  Info,
  ListChecks,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { AuditReport, Finding, Severity } from "@/lib/engine/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const severityTone: Record<Severity, string> = {
  Critical: "text-destructive",
  High: "text-destructive",
  Medium: "text-warning",
  Low: "text-sky-500",
  Info: "text-muted-foreground",
};

const severityBadge: Record<Severity, "destructive" | "warning" | "primary" | "neutral"> = {
  Critical: "destructive",
  High: "destructive",
  Medium: "warning",
  Low: "primary",
  Info: "neutral",
};

const riskColor: Record<AuditReport["riskLabel"], string> = {
  Critical: "text-destructive",
  High: "text-destructive",
  Medium: "text-warning",
  Low: "text-success",
};

function scoreColor(score: number): string {
  if (score >= 70) return "border-destructive text-destructive";
  if (score >= 45) return "border-warning text-warning";
  if (score >= 20) return "border-sky-500 text-sky-500";
  return "border-success text-success";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={severityBadge[finding.severity]}>{finding.severity}</Badge>
        <Badge tone="neutral">{finding.risk} risk</Badge>
        <span className="text-xs text-muted-foreground">
          {finding.category} - {Math.round(finding.confidence * 100)}% confidence
        </span>
      </div>
      <h4 className="mt-2 font-semibold text-foreground">{finding.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {finding.explanation}
      </p>
      {finding.evidence.available && finding.evidence.text ? (
        <blockquote className="mt-3 rounded-lg border-l-2 border-border bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
          &ldquo;{finding.evidence.text.slice(0, 280)}
          {finding.evidence.text.length > 280 ? "..." : ""}&rdquo;
          {finding.evidence.page ? (
            <span className="not-italic"> (page {finding.evidence.page})</span>
          ) : null}
        </blockquote>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" /> Insufficient evidence - no supporting text found.
        </p>
      )}
      <div className="mt-3 flex items-start gap-2 text-sm">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="text-foreground">{finding.recommendation}</span>
      </div>
    </div>
  );
}

export function AuditReportView({ report }: { report: AuditReport }) {
  if (report.status === "error") {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 animate-fade-in"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h3 className="font-semibold text-foreground">Analysis could not be completed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.error ?? "An unknown error occurred."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Audit report - logic-v1
            </p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              {report.toolName}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {report.documentName} - generated {formatDate(report.generatedAt)}
            </p>
            {report.detectedDocumentType ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Detected type:{" "}
                <span className="font-medium text-foreground">
                  {report.detectedDocumentType}
                </span>
              </p>
            ) : null}
          </div>
          <div className="text-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border-4 text-sm font-bold",
                scoreColor(report.riskScore),
              )}
            >
              {report.riskScore}/100
            </div>
            <p className={cn("mt-1 text-xs font-semibold uppercase", riskColor[report.riskLabel])}>
              {report.riskLabel} risk
            </p>
          </div>
        </div>
        {report.ocrNotice ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{report.ocrNotice}</span>
          </p>
        ) : null}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{report.summary}</p>
      </div>

      {/* Critical findings */}
      {report.criticalFindings.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold text-foreground">
              Priority findings ({report.criticalFindings.length})
            </h3>
          </div>
          {report.criticalFindings.map((f) => (
            <FindingCard key={`${f.id}-${f.title}`} finding={f} />
          ))}
        </div>
      ) : null}

      {/* All findings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">
            All findings ({report.findings.length})
          </h3>
        </div>
        {report.findings.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No issues were flagged in this document.
          </p>
        ) : (
          report.findings.map((f) => (
            <FindingCard key={`${f.id}-${f.title}-${f.evidence.text.slice(0, 40)}`} finding={f} />
          ))
        )}
      </div>

      {/* Evidence */}
      {report.evidenceList.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence excerpts ({report.evidenceList.length})
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {report.evidenceList.map((e, i) => (
              <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                &ldquo;{e.excerpt}...&rdquo;
                {e.page ? <span> (page {e.page})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Recommendations */}
      {report.recommendations.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recommendations ({report.recommendations.length})
            </h3>
          </div>
          <ol className="mt-3 space-y-2">
            {report.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone="neutral">{r.priority}</Badge>
                <span className="text-foreground">{r.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Missing information */}
      {report.missingInformation.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Missing information ({report.missingInformation.length})
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {report.missingInformation.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone={severityBadge[m.severity]}>{m.severity}</Badge>
                <span className="text-foreground">{m.item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Document stats + confidence */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Document stats
            </h3>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Words</dt>
            <dd className="text-right font-medium text-foreground">{report.documentStats.words}</dd>
            <dt className="text-muted-foreground">Lines</dt>
            <dd className="text-right font-medium text-foreground">{report.documentStats.lines}</dd>
            <dt className="text-muted-foreground">Input type</dt>
            <dd className="text-right font-medium text-foreground">{report.documentStats.inputType}</dd>
            <dt className="text-muted-foreground">Read time</dt>
            <dd className="text-right font-medium text-foreground">
              ~{Math.max(1, Math.round(report.documentStats.estimatedReadTimeSeconds / 60))} min
            </dd>
            <dt className="text-muted-foreground">OCR used</dt>
            <dd className="text-right font-medium text-foreground">
              {report.documentStats.usedOcr ? "Yes" : "No"}
            </dd>
            <dt className="text-muted-foreground">Pages</dt>
            <dd className="text-right font-medium text-foreground">
              {report.documentStats.pages ?? "n/a"}
            </dd>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Report confidence
            </h3>
          </div>
          <p className="mt-3 text-3xl font-bold text-foreground">
            {report.confidence.overall}
            <span className="text-base font-normal text-muted-foreground">/100</span>
          </p>
          {report.confidence.notes.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {report.confidence.notes.map((n, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  - {n}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Disclaimer: </span>
        {report.disclaimer}
      </div>
    </div>
  );
}
