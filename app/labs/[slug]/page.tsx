"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { NotFoundState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { RequireAuth } from "@/components/auth/RequireAuth";
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
          description={`The lab "${params.slug}" does not exist.`}
          action={
            <Link href="/labs">
              <Button>Browse all labs</Button>
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
          title={lab.name}
          description={lab.description}
          icon={<ToolIcon icon={lab.icon} accentKey={lab.accent} size="md" />}
          breadcrumbs={[
            { label: "Labs", href: "/labs" },
            { label: lab.name },
          ]}
          actions={
            <Link href="/labs">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> All labs
              </Button>
            </Link>
          }
        />

        <LabClient lab={lab} />
      </Container>
    </RequireAuth>
  );
}
