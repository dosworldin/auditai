"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { History, Loader2, Play } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";
import { RiskBadge } from "@/components/ui/Badge";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";

interface AuditRecord {
  id: string;
  tool_name: string;
  tool_slug: string;
  document_name: string | null;
  status: string;
  risk_label: string;
  used_credits: number;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export default function HistoryPage() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("audit_requests")
          .select("id, tool_name, tool_slug, document_name, status, used_credits, duration_ms, created_at, completed_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        // Get risk labels from reports
        const { data: reports } = await supabase
          .from("audit_reports")
          .select("id, risk_label")
          .eq("user_id", user.id);

        const reportMap = new Map<string, string>();
        for (const r of (reports ?? []) as Array<{ id: string; risk_label: string }>) {
          reportMap.set(r.id, r.risk_label);
        }

        const records: AuditRecord[] = ((data as unknown as AuditRecord[]) ?? []).map((a) => ({
          ...a,
          risk_label: reportMap.get(a.id) ?? "None",
        }));

        setAudits(records);
      } catch {
        // Failed to load
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Audit History"
          description="Every audit you run is listed here with its status and risk outcome."
          icon={<History className="h-5 w-5" />}
          actions={
            <Link href="/tools">
              <Button>
                <Play className="h-4 w-4" /> New audit
              </Button>
            </Link>
          }
        />

        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading history...</span>
            </div>
          </Card>
        ) : audits.length > 0 ? (
          <Card>
            <Table
              head={
                <>
                  <Th>Document</Th>
                  <Th>Tool</Th>
                  <Th>Status</Th>
                  <Th>Risk</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Actions</Th>
                </>
              }
            >
              {audits.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium text-foreground">
                    {row.document_name ?? "Untitled"}
                  </Td>
                  <Td>
                    <Link
                      href={`/tools/${row.tool_slug}`}
                      className="text-primary hover:underline"
                    >
                      {row.tool_name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        row.status === "completed"
                          ? "success"
                          : row.status === "failed"
                            ? "destructive"
                            : row.status === "processing"
                              ? "warning"
                              : "info"
                      }
                    >
                      {row.status}
                    </Badge>
                  </Td>
                  <Td>
                    <RiskBadge risk={row.risk_label as "Low" | "Medium" | "High" | "None"} />
                  </Td>
                  <Td className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </Td>
                  <Td className="text-right">
                    {row.status === "completed" ? (
                      <Link href={`/reports/${row.id}`}>
                        <Button variant="ghost" size="sm">View report</Button>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No audits yet"
            description="Your audit history will appear here. Run an audit from the tools catalog to get started."
            action={
              <Link href="/tools">
                <Button size="sm">Browse tools</Button>
              </Link>
            }
          />
        )}
      </Container>
    </RequireAuth>
  );
}
