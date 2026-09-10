"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Printer, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";
import { getTool } from "@/lib/tools/registry";

interface ReportData {
  id: string;
  tool_name: string;
  tool_slug: string;
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

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const toggleShare = async () => {
    if (!report) return;
    setShareBusy(true);
    try {
      const res = await fetch("/api/reports/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: params.id, action: shareSlug ? "revoke" : "create" }),
      });
      const data = await res.json();
      if (res.ok && data.shared) {
        setShareSlug(data.slug);
      } else if (res.ok) {
        setShareSlug(null);
      } else {
        alert(data.error || "Share failed");
      }
    } finally {
      setShareBusy(false);
    }
  };

  const shareUrl = shareSlug && typeof window !== "undefined" ? `${window.location.origin}/share/${shareSlug}` : "";

  const copyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const whatsappHref = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`I just audited a document with AuditAI — check this report: ${shareUrl}`)}`
    : "";

  useEffect(() => {
    async function loadReport() {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("audit_reports")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single();

        if (data) {
          const row = data as unknown as ReportData & {
            public_share_slug: string | null;
            is_publicly_shared: boolean;
          };
          setReport(row);
          setShareSlug(row.is_publicly_shared ? row.public_share_slug : null);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [params.id]);

  if (loading) {
    return (
      <RequireAuth>
        <Container className="flex min-h-[50vh] items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading report...</span>
        </Container>
      </RequireAuth>
    );
  }

  if (notFound || !report) {
    return (
      <RequireAuth>
        <Container className="py-16">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">Report not found</p>
            <p className="mt-2 text-sm text-muted-foreground">This report does not exist or you don&apos;t have access.</p>
            <Link href="/reports">
              <Button className="mt-4">Back to reports</Button>
            </Link>
          </div>
        </Container>
      </RequireAuth>
    );
  }

  const tool = getTool(report.tool_slug);
  const rd = report.report_data as Record<string, unknown>;
  const findings = (rd?.findings ?? []) as Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    explanation: string;
    recommendation: string;
    confidence: number;
  }>;
  const recommendations = (rd?.recommendations ?? []) as Array<{ text: string; priority: string }>;

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title={report.tool_name}
          description={`Risk score: ${report.risk_score}/100 (${report.risk_label})`}
          icon={<FileText className="h-5 w-5" />}
          breadcrumbs={[
            { label: "Reports", href: "/reports" },
            { label: report.tool_name },
          ]}
          actions={
            <Link href="/reports">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> All reports
              </Button>
            </Link>
          }
        />

        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardContent>
              <p className="mb-4 text-sm font-semibold text-foreground">Executive summary</p>
              <p className="text-sm text-muted-foreground">
                {report.summary ?? "No summary available."}
              </p>
              {report.document_name && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Document: {report.document_name}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Findings */}
              {findings.length > 0 && (
                <Card>
                  <CardHeader title={`Findings (${findings.length})`} />
                  <CardContent className="space-y-4">
                    {findings.map((f) => (
                      <div key={f.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Badge tone={f.severity === "Critical" || f.severity === "High" ? "destructive" : f.severity === "Medium" ? "warning" : "info"}>
                              {f.severity}
                            </Badge>
                            <h4 className="mt-2 font-medium text-foreground">{f.title}</h4>
                          </div>
                          <span className="text-xs text-muted-foreground">{Math.round(f.confidence * 100)}% confidence</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{f.explanation}</p>
                        {f.recommendation && (
                          <p className="mt-2 text-sm text-primary">{f.recommendation}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <Card>
                  <CardHeader title="Recommendations" />
                  <CardContent className="space-y-2">
                    {recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Badge tone={r.priority === "Critical" ? "destructive" : r.priority === "High" ? "warning" : "info"}>
                          {r.priority}
                        </Badge>
                        <span className="text-foreground">{r.text}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {findings.length === 0 && (
                <Card>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No findings in this report.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Report details"
                  icon={tool ? <ToolIcon icon={tool.icon} accentKey={tool.accent} size="sm" /> : undefined}
                />
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tool</span>
                    <span className="font-medium text-foreground">{report.tool_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Risk score</span>
                    <span className="font-medium text-foreground">{report.risk_score}/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Findings</span>
                    <span className="font-medium text-foreground">{report.findings_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Critical</span>
                    <span className="font-medium text-foreground">{report.critical_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Generated</span>
                    <span className="font-medium text-foreground">
                      {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Share this report"
                  subtitle="Public link — anyone can view, nothing private is exposed"
                />
                <CardContent className="space-y-2">
                  {shareSlug ? (
                    <>
                      <Button className="w-full" onClick={copyShareLink} disabled={shareBusy}>
                        {shareCopied ? "Link copied!" : "Copy share link"}
                      </Button>
                      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="block">
                        <Button className="w-full" variant="outline">
                          Share on WhatsApp
                        </Button>
                      </a>
                      <Button className="w-full" variant="ghost" onClick={toggleShare} disabled={shareBusy}>
                        Stop sharing (revoke link)
                      </Button>
                    </>
                  ) : (
                    <Button className="w-full" onClick={toggleShare} disabled={shareBusy}>
                      Create public share link
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2">
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
