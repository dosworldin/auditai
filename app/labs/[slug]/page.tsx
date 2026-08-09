"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { NotFoundState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { LabClient } from "@/components/labs/LabClient";
import { getLab } from "@/lib/labs/registry";

export default function LabPage() {
  const params = useParams<{ slug: string }>();
  const lab = getLab(params.slug);

  if (!lab) {
    return (
      <Container className="py-16">
        <NotFoundState
          title="Lab not found"
          description={`The experiment "${params.slug}" does not exist.`}
          action={
            <Link href="/labs">
              <Button>Back to Labs</Button>
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <PageHeader
        title={lab.name}
        description={lab.description}
        icon={<ToolIcon icon={lab.icon} accentKey={lab.accent} size="md" />}
        breadcrumbs={[
          { label: "Labs", href: "/labs" },
          { label: lab.category, href: "/labs" },
          { label: lab.name },
        ]}
        actions={
          <Link href="/labs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> All Labs
            </Button>
          </Link>
        }
      />

      <div className="mb-6">
        <BlueprintNote>
          {lab.status} module - blueprint interface only. The experimental
          processing engine for this lab is deferred to a future phase.
        </BlueprintNote>
      </div>

      <LabClient lab={lab} />
    </Container>
  );
}
