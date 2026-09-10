"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { getTool } from "@/lib/tools/registry";

interface SharedReport {
  tool_slug: string;
  tool_name: string;
  document_name: string | null;
  risk_score: number;
  risk_label: string;
  summary: string | null;
  report_data: Record<string, unknown>;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  created_at: string;
}

interface Finding {
  id: string;
  severity: string;
  category: string;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
}

/**
 * Public shareable report — the viral loop surface.
 * Anyone with the link sees a read-only, branded report and a strong CTA
 * to run their own audit. No auth required; only explicitly-shared reports resolve.
 */
export default function SharedReportPage() {
  const params = useParams<{ slug: string }>();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/reports/public/${params.slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const data = await r.json();
        setReport(data.report);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading shared report…</span>
      </Container>
    );
  }

  if (notFound || !report) {
    return (
      <Container className="py-16 text-center">
        <p className="text-lg font-semibold text-foreground">This report link is not available</p>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been unshared by its owner. Audit your own document instead — it takes seconds.
        </p>
        <Link href="/tools" passHref legacyBehavior>
          <Button className="mt-4" onClick={undefined}>
            Browse free audit tools <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </Container>
    );
  }

  const tool = getTool(report.tool_slug);
  const rd = report.report_data as Record<string, unknown>;
  const findings = (rd?.findings ?? []) as Finding[];
  const riskTone =
    report.risk_label === "High" || report.risk_label === "Critical"
      ? "destructive"
      : report.risk_label === "Medium"
        ? "warning"
        : "success";

  return (
    <Container className="py-8">
      {/* Viral CTA banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-foreground">
            This audit was generated with AuditAI — analyze your own document free.
          </p>
        </div>
        <Link href="/tools">
          <Button size="sm">
            Run your own audit <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          {tool && <ToolIcon icon={tool.icon} accentKey={tool.accent} size="md" />}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{report.tool_name}</h1>
            <p className="text-sm text-muted-foreground">
              Shared audit report ·{" "}
              {new Date(report.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Risk score</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{report.risk_score}/100</p>
            </div>
            <Badge tone={riskTone}>{report.risk_label} risk</Badge>
            <div className="text-sm text-muted-foreground">
              {report.findings_count} findings · {report.critical_count} critical ·{" "}
              {report.high_count} high
            </div>
          </CardContent>
        </Card>

        {report.summary && (
          <Card>
            <CardHeader title="Executive summary" />
            <CardContent>
              <p className="text-sm text-muted-foreground">{report.summary}</p>
            </CardContent>
          </Card>
        )}

        {findings.length > 0 && (
          <Card>
            <CardHeader title={`Key findings (${findings.length})`} />
            <CardContent className="space-y-4">
              {findings.slice(0, 8).map((f) => (
                <div key={f.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-foreground">{f.title}</h4>
                    <Badge
                      tone={
                        f.severity === "Critical" || f.severity === "High"
                          ? "destructive"
                          : f.severity === "Medium"
                            ? "warning"
                            : "info"
                      }
                    >
                      {f.severity}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{f.explanation}</p>
                </div>
              ))}
              {findings.length > 8 && (
                <p className="text-xs text-muted-foreground">
                  +{findings.length - 8} more findings in the full report
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            Have a contract, invoice, or policy to check?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            AuditAI reviews 40+ document types in seconds — first audit is free.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link href="/tools">
              <Button>Explore all tools <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </Link>
            <Link href="/storyverse">
              <Button variant="outline">Discover StoryVerse</Button>
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
