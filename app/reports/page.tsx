"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, FolderOpen } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";
import { RiskBadge } from "@/components/ui/Badge";
import { TOOL_REGISTRY } from "@/lib/tools/registry";

export default function ReportsPage() {
  const [saved, setSaved] = useState(false);

  return (
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

      {saved ? (
        <Card>
          <Table
            head={
              <>
                <Th>Report</Th>
                <Th>Tool</Th>
                <Th>Risk</Th>
                <Th>Generated</Th>
                <Th className="text-right">Actions</Th>
              </>
            }
          >
            {TOOL_REGISTRY.slice(0, 4).map((tool, i) => (
              <tr key={tool.slug}>
                <Td className="font-medium text-foreground">
                  {tool.name} - Sample {i + 1}
                </Td>
                <Td>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="text-primary hover:underline"
                  >
                    {tool.name}
                  </Link>
                </Td>
                <Td>
                  <RiskBadge risk={i % 2 === 0 ? "Low" : "Medium"} />
                </Td>
                <Td className="text-muted-foreground">2026-08-09</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/reports/sample-${tool.slug}`}>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSaved((prev) => prev && i !== 0 ? prev : true)
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Sample reports are illustrative. Report storage and export are
              implemented in a future phase.
            </p>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No saved reports"
          description="Reports you generate and save will appear here. You can also open a blueprint preview report to see the structure."
          action={
            <div className="flex gap-2">
              <Link href="/tools">
                <Button size="sm">Run an audit</Button>
              </Link>
              <Link href="/reports/sample-contract-watchdog">
                <Button size="sm" variant="outline">
                  Preview a sample report
                </Button>
              </Link>
            </div>
          }
        />
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Reports are blueprint previews only; no analysis is performed yet.
      </p>
    </Container>
  );
}
