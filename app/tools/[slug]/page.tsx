"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { NotFoundState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { ToolClient } from "@/components/tools/ToolClient";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { getTool } from "@/lib/tools/registry";

export default function ToolPage() {
  const params = useParams<{ slug: string }>();
  const tool = getTool(params.slug);

  if (!tool) {
    return (
      <Container className="py-16">
        <NotFoundState
          title="Tool not found"
          description={`The tool "${params.slug}" does not exist in the registry.`}
          action={
            <Link href="/tools">
              <Button>Browse all tools</Button>
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title={tool.name}
          description={tool.tagline}
          icon={<ToolIcon icon={tool.icon} accentKey={tool.accent} size="md" />}
          breadcrumbs={[
            { label: "Audit Tools", href: "/tools" },
            { label: tool.category, href: "/tools" },
            { label: tool.name },
          ]}
          actions={
            <Link href="/tools">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> All tools
              </Button>
            </Link>
          }
        />

        <ToolClient tool={tool} />
      </Container>
    </RequireAuth>
  );
}
