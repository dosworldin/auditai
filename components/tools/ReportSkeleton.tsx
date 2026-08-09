import { BarChart3, CheckCircle2, FileSearch, Gauge, ListChecks, ShieldAlert } from "lucide-react";
import type { ReportSection } from "@/lib/types";
import { SkeletonLines } from "@/components/ui/Feedback";
import { cn } from "@/lib/utils";

const kindMeta = {
  overview: { icon: FileSearch, label: "Summary" },
  score: { icon: Gauge, label: "Score" },
  findings: { icon: ListChecks, label: "Findings" },
  clauses: { icon: FileSearch, label: "Detailed review" },
  details: { icon: ListChecks, label: "Details" },
  chart: { icon: BarChart3, label: "Charts" },
  actions: { icon: CheckCircle2, label: "Actions" },
  verdict: { icon: ShieldAlert, label: "Verdict" },
} as const;

export function ReportSectionPlaceholder({
  section,
  index,
}: {
  section: ReportSection;
  index: number;
}) {
  const meta = kindMeta[section.kind];
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {index + 1}. {meta.label}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">
        {section.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
      <div className="mt-4">
        <SkeletonLines lines={3} />
      </div>
      <p className="mt-4 inline-flex rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">
        Blueprint placeholder - content generated in a future phase
      </p>
    </div>
  );
}

export function ReportHeader({
  toolName,
  documentName,
  generatedAt,
}: {
  toolName: string;
  documentName: string;
  generatedAt: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Audit report
          </p>
          <h2 className="mt-1 text-lg font-bold text-foreground">
            {toolName} - {documentName}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Generated {generatedAt} - blueprint preview, no analysis performed
          </p>
        </div>
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border-4 border-dashed border-muted-foreground/30 text-xs font-semibold text-muted-foreground",
          )}
        >
          --/100
        </div>
      </div>
    </div>
  );
}
