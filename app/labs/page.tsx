"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LAB_REGISTRY } from "@/lib/labs/registry";

export default function LabsPage() {
  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Labs"
          description="Experimental AI capabilities — test new features before they graduate into stable tools."
          icon={<FlaskConical className="h-5 w-5" />}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LAB_REGISTRY.map((lab) => (
            <Link key={lab.slug} href={`/labs/${lab.slug}`}>
              <Card interactive>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <ToolIcon icon={lab.icon} accentKey={lab.accent} size="md" />
                    <div>
                      <h3 className="font-semibold text-foreground">{lab.name}</h3>
                      <Badge tone={lab.status === "Coming Soon" ? "warning" : lab.status === "Beta" ? "info" : "success"}>
                        {lab.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{lab.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {lab.inputs.slice(0, 4).map((input) => (
                      <Badge key={input} tone="neutral">{input}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Container>
    </RequireAuth>
  );
}
