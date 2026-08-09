"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Package, Plus } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ToolIcon } from "@/components/ui/ToolIcon";

export default function MarketplaceDetailPage() {
  const params = useParams<{ id: string }>();
  const [installed, setInstalled] = useState(false);

  const displayName = params.id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <Container className="py-8">
      <PageHeader
        title={displayName}
        description="Blueprint listing detail page."
        icon={<Package className="h-5 w-5" />}
        breadcrumbs={[
          { label: "Marketplace", href: "/marketplace" },
          { label: displayName },
        ]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Listing details are placeholders. Installation, purchasing and
          licensing arrive in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex items-start gap-4">
                <ToolIcon icon={Package} accentKey="indigo" size="lg" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {displayName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Extension - Marketplace blueprint
                  </p>
                </div>
              </div>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                This listing demonstrates the marketplace product page structure.
                Full descriptions, screenshots, version history, and reviews
                will be populated in a future phase.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Overview" />
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Version: 1.0.0 (blueprint)</p>
              <p>Compatibility: AuditAI Platform Blueprint 1</p>
              <p>Requires: none</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="text-3xl font-extrabold text-foreground">
                  $19.99
                </span>
              </div>
              {installed ? (
                <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success animate-fade-in">
                  Installed (simulated)
                </div>
              ) : (
                <Button className="w-full" onClick={() => setInstalled(true)}>
                  <Plus className="h-4 w-4" /> Install
                </Button>
              )}
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4" /> Download
              </Button>
            </CardContent>
          </Card>

          <Link href="/marketplace">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="h-4 w-4" /> Back to marketplace
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
