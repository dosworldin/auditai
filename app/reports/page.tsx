"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, FolderOpen, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";
import { RiskBadge } from "@/components/ui/Badge";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";

interface Report {
  id: string;
  tool_name: string;
  tool_slug: string;
  document_name: string | null;
  risk_score: number;
  risk_label: string;
  summary: string | null;
  findings_count: number;
  critical_count: number;
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("audit_reports")
          .select("id, tool_name, tool_slug, document_name, risk_score, risk_label, summary, findings_count, critical_count, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        setReports((data as unknown as Report[]) ?? []);
      } catch {
        // Failed to load
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Reports"
          description="Your generated audit reports, saved for reference and sharing."
          icon={<FileText className="h-5 w-5" />}
          actions={
            <Link href="/tools">
              <Button>
                <FolderOpen className="h-4 w-4" /> Generate a report
              </Button>
            </Link>
          }
        />

        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading reports...</span>
            </div>
          </Card>
        ) : reports.length > 0 ? (
          <Card>
            <Table
              head={
                <>
                  <Th>Report</Th>
                  <Th>Tool</Th>
                  <Th>Risk</Th>
                  <Th>Findings</Th>
                  <Th>Generated</Th>
                  <Th className="text-right">Actions</Th>
                </>
              }
            >
              {reports.map((report) => (
                <tr key={report.id}>
                  <Td className="font-medium text-foreground">
                    {report.document_name ?? report.tool_name}
                  </Td>
                  <Td>
                    <Link
                      href={`/tools/${report.tool_slug}`}
                      className="text-primary hover:underline"
                    >
                      {report.tool_name}
                    </Link>
                  </Td>
                  <Td>
                    <RiskBadge risk={report.risk_label as "Low" | "Medium" | "High" | "None"} />
                  </Td>
                  <Td className="text-muted-foreground">
                    {report.findings_count} ({report.critical_count} critical)
                  </Td>
                  <Td className="text-muted-foreground">
                    {new Date(report.created_at).toLocaleDateString()}
                  </Td>
                  <Td className="text-right">
                    <Link href={`/reports/${report.id}`}>
                      <Button variant="ghost" size="sm">Open</Button>
                    </Link>
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No saved reports"
            description="Reports you generate will appear here. Run an audit from the tools catalog to get started."
            action={
              <Link href="/tools">
                <Button size="sm">Run an audit</Button>
              </Link>
            }
          />
        )}
      </Container>
    </RequireAuth>
  );
}
