"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, FileText, FolderOpen, Library } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { TOOL_REGISTRY } from "@/lib/tools/registry";

export default function LibraryPage() {
  const [showSamples, setShowSamples] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Library"
        description="Your saved reports, resources and templates across the platform."
        icon={<Library className="h-5 w-5" />}
      />

      {showSamples ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_REGISTRY.slice(0, 6).map((tool, i) => (
            <Link key={tool.slug} href={`/reports/sample-${tool.slug}`}>
              <Card interactive className="h-full">
                <div className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <FileText className="h-5 w-5" />
                    </span>
                    <Badge tone="neutral">Report</Badge>
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">
                    {tool.name} - Audit #{1000 + i}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    Saved on Aug 9, 2026 (sample)
                  </p>
                </div>
              </Card>
            </Link>
          ))}
          <p className="text-xs text-muted-foreground lg:col-span-3">
            Sample library items are illustrative only and are not persisted.
          </p>
        </div>
      ) : (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="Your library is empty"
          description="Save reports, resources and templates to keep them organized in one place."
          action={
            <div className="flex gap-2">
              <Link href="/reports">
                <Button size="sm">Browse reports</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setShowSamples(true)}>
                Load sample items
              </Button>
            </div>
          }
        />
      )}

    </Container>
  );
}
