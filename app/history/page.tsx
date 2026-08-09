"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Play, Trash2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";
import { RiskBadge } from "@/components/ui/Badge";
import type { AuditRecord } from "@/lib/types";

const SAMPLE_AUDITS: AuditRecord[] = [
  {
    id: "aud-1001",
    toolSlug: "contract-watchdog",
    toolName: "Contract Watchdog",
    document: "Vendor-agreement-2026.pdf",
    status: "Completed",
    risk: "Medium",
    createdAt: "2026-08-09",
    duration: "28s",
  },
  {
    id: "aud-1002",
    toolSlug: "salary-slip-analyzer",
    toolName: "Salary Slip Analyzer",
    document: "Salary-Slip-May.pdf",
    status: "Completed",
    risk: "Low",
    createdAt: "2026-08-08",
    duration: "12s",
  },
  {
    id: "aud-1003",
    toolSlug: "bank-statement-analyzer",
    toolName: "Bank Statement Analyzer",
    document: "Statement-HDFC.xlsx",
    status: "Failed",
    risk: "None",
    createdAt: "2026-08-07",
    duration: "5s",
  },
  {
    id: "aud-1004",
    toolSlug: "gst-invoice-checker",
    toolName: "GST Invoice Checker",
    document: "Invoice-2210.pdf",
    status: "Completed",
    risk: "High",
    createdAt: "2026-08-06",
    duration: "31s",
  },
  {
    id: "aud-1005",
    toolSlug: "scam-detector",
    toolName: "Scam Detector",
    document: "Message-from-bank.txt",
    status: "Queued",
    risk: "None",
    createdAt: "2026-08-05",
    duration: "--",
  },
];

export default function HistoryPage() {
  const [showSamples, setShowSamples] = useState(false);
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [notice, setNotice] = useState("");

  const loadSamples = () => {
    setRows(SAMPLE_AUDITS);
    setShowSamples(true);
    setNotice("");
  };

  return (
    <Container className="py-8">
      <PageHeader
        title="Audit History"
        description="Every audit you run is listed here with its status and risk outcome."
        icon={<History className="h-5 w-5" />}
        actions={
          <>
            {!showSamples ? (
              <Button variant="outline" onClick={loadSamples}>
                Load sample data
              </Button>
            ) : null}
            <Link href="/tools">
              <Button>
                <Play className="h-4 w-4" /> New audit
              </Button>
            </Link>
          </>
        }
      />

      {showSamples ? (
        <Card>
          <Table
            head={
              <>
                <Th>Document</Th>
                <Th>Tool</Th>
                <Th>Status</Th>
                <Th>Risk</Th>
                <Th>Date</Th>
                <Th>Duration</Th>
                <Th className="text-right">Actions</Th>
              </>
            }
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium text-foreground">{row.document}</Td>
                <Td>
                  <Link
                    href={`/tools/${row.toolSlug}`}
                    className="text-primary hover:underline"
                  >
                    {row.toolName}
                  </Link>
                </Td>
                <Td>
                  <Badge
                    tone={
                      row.status === "Completed"
                        ? "success"
                        : row.status === "Failed"
                          ? "destructive"
                          : row.status === "Queued"
                            ? "warning"
                            : "info"
                    }
                  >
                    {row.status}
                  </Badge>
                </Td>
                <Td>
                  <RiskBadge risk={row.risk} />
                </Td>
                <Td className="text-muted-foreground">{row.createdAt}</Td>
                <Td className="text-muted-foreground">{row.duration}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {row.status === "Completed" ? (
                      <Link href={`/reports/${row.id}`}>
                        <Button variant="ghost" size="sm">
                          View report
                        </Button>
                      </Link>
                    ) : row.status === "Failed" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setNotice(
                            "Blueprint: retry logic lands in a future phase. The sample row was not re-queued.",
                          )
                        }
                      >
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${row.document}`}
                      onClick={() =>
                        setRows((prev) => prev.filter((r) => r.id !== row.id))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No audits yet"
          description="Your audit history will appear here. Run an audit from the tools catalog to get started, or load sample data to preview the table."
          action={
            <div className="flex gap-2">
              <Link href="/tools">
                <Button size="sm">Browse tools</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={loadSamples}>
                Load sample data
              </Button>
            </div>
          }
        />
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Sample rows are illustrative only and are not persisted. History
        persistence is implemented in a future phase.
      </p>

      {notice ? (
        <div className="mt-4 rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-foreground animate-fade-in">
          {notice}
        </div>
      ) : null}
    </Container>
  );
}
