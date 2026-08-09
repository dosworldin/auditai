"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Printer, Share2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { ReportHeader, ReportSectionPlaceholder } from "@/components/tools/ReportSkeleton";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { getTool } from "@/lib/tools/registry";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const slug = params.id.replace(/^sample-/, "");
  const tool =
    getTool(slug) ?? getTool("contract-watchdog")!;
  const [shareOpen, setShareOpen] = useState(false);
  const [exported, setExported] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Audit Report"
        description="Blueprint preview of the report page structure."
        icon={<FileText className="h-5 w-5" />}
        breadcrumbs={[
          { label: "Reports", href: "/reports" },
          { label: tool.name },
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
        <ReportHeader
          toolName={tool.name}
          documentName={`${tool.name.toLowerCase().replace(/\s+/g, "-")}-sample.pdf`}
          generatedAt="Aug 9, 2026, 10:24 AM"
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent>
                <p className="mb-4 text-sm font-semibold text-foreground">
                  Executive summary
                </p>
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                </div>
                <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Blueprint placeholder - executive summary generated in a
                  future phase.
                </p>
              </CardContent>
            </Card>

            {tool.reportSections.map((section, i) => (
              <ReportSectionPlaceholder key={section.title} section={section} index={i} />
            ))}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setExported(true)}>
                <Download className="h-4 w-4" /> Export report
              </Button>
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button variant="outline" onClick={() => setExported(true)}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>

            {exported ? (
              <div
                className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-foreground animate-fade-in"
                role="status"
              >
                Blueprint: export is simulated. File generation will be
                implemented in a future phase.
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Report details"
                icon={<ToolIcon icon={tool.icon} accentKey={tool.accent} size="sm" />}
              />
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tool</span>
                  <Link href={`/tools/${tool.slug}`} className="font-medium text-primary hover:underline">
                    {tool.name}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <Badge tone="primary">{tool.category}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sections</span>
                  <span className="font-medium text-foreground">
                    {tool.reportSections.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge tone="info">Blueprint preview</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-semibold text-foreground">
                  Actions
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Save a copy to your library</li>
                  <li>Re-run this audit with different settings</li>
                  <li>Download as PDF for offline review</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share report"
        description="Blueprint: sharing links will be enabled in a future phase."
        footer={
          <Button variant="outline" onClick={() => setShareOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <Input readOnly value="https://auditai.app/share/REPORT_ID" />
          <p className="text-xs text-muted-foreground">
            Shareable report links are not available during the blueprint phase.
          </p>
        </div>
      </Dialog>
    </Container>
  );
}
