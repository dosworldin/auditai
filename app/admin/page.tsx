"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, FlaskConical, LayoutGrid, ServerCog, ShieldCheck, Table2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Td, Th } from "@/components/ui/Table";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { LAB_REGISTRY } from "@/lib/labs/registry";
import { PROCESSING_DECISIONS } from "@/lib/processing/blueprint";
import { formatUsd } from "@/lib/utils";

const platformStats = [
  { label: "Audit tools", value: TOOL_REGISTRY.length, icon: LayoutGrid },
  { label: "Labs modules", value: LAB_REGISTRY.length, icon: FlaskConical },
  { label: "Platform routes", value: 45, icon: Activity },
  { label: "Background workers", value: 0, icon: ServerCog },
];

export default function AdminPage() {
  const [tab, setTab] = useState("overview");

  return (
    <Container className="py-8">
      <PageHeader
        title="Admin"
        description="Blueprint-phase administration overview. Nothing here is editable yet."
        icon={<ShieldCheck className="h-5 w-5" />}
      />

      <div className="mb-6">
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: "overview", label: "Overview", icon: <Activity className="h-4 w-4" /> },
            { id: "tools", label: "Tools", icon: <LayoutGrid className="h-4 w-4" /> },
            { id: "labs", label: "Labs", icon: <FlaskConical className="h-4 w-4" /> },
            { id: "processing", label: "Processing", icon: <ServerCog className="h-4 w-4" /> },
          ]}
        />
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {platformStats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <stat.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Processing architecture"
              subtitle="Blueprint decisions for this phase"
            />
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">BullMQ / background workers:</span>{" "}
                none. No asynchronous job queue is used anywhere in this phase.
              </p>
              <p>
                <span className="font-semibold text-foreground">OCR:</span> on-demand only. OCR is
                triggered exclusively when an input document actually requires it (scanned or
                image-based files). Selectable-text PDFs, TXT and DOCX use direct text extraction.
              </p>
              <p>
                <span className="font-semibold text-foreground">Payments:</span> not implemented.
                Billing, payouts and revenue sharing are future-phase work.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "tools" ? (
        <Card>
          <Table
            head={
              <>
                <Th>Tool</Th>
                <Th>Category</Th>
                <Th>Inputs</Th>
                <Th>Pricing</Th>
                <Th>Credits</Th>
                <Th>Status</Th>
              </>
            }
          >
            {TOOL_REGISTRY.map((tool) => (
              <tr key={tool.slug}>
                <Td>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
                  >
                    <ToolIcon icon={tool.icon} accentKey={tool.accent} size="sm" />
                    {tool.name}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">{tool.category}</Td>
                <Td className="text-muted-foreground">
                  {tool.inputs.length} types
                </Td>
                <Td className="text-muted-foreground">
                  {formatUsd(tool.pricing.priceUsd)}
                </Td>
                <Td className="text-muted-foreground">
                  {tool.pricing.creditsPerRun}
                </Td>
                <Td>
                  <Badge tone="info">Blueprint</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {tab === "labs" ? (
        <Card>
          <Table
            head={
              <>
                <Th>Module</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Inputs</Th>
                <Th>Status label</Th>
              </>
            }
          >
            {LAB_REGISTRY.map((lab) => (
              <tr key={lab.slug}>
                <Td>
                  <Link
                    href={`/labs/${lab.slug}`}
                    className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
                  >
                    <ToolIcon icon={lab.icon} accentKey={lab.accent} size="sm" />
                    {lab.name}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">{lab.category}</Td>
                <Td>
                  <Badge tone={lab.status === "Beta" ? "info" : "warning"}>
                    {lab.status}
                  </Badge>
                </Td>
                <Td className="text-muted-foreground">
                  {lab.inputs.length} types
                </Td>
                <Td>
                  <Badge tone="neutral">Blueprint</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {tab === "processing" ? (
        <Card>
          <CardHeader
            title="Input to pipeline mapping"
            subtitle="Defines when OCR and async processing are required"
            icon={<Table2 className="h-4 w-4" />}
          />
          <Table
            head={
              <>
                <Th>Input type</Th>
                <Th>Pipeline</Th>
                <Th>OCR</Th>
                <Th>Async required</Th>
              </>
            }
          >
            {PROCESSING_DECISIONS.map((decision) => (
              <tr key={decision.inputType}>
                <Td className="font-medium text-foreground">{decision.inputType}</Td>
                <Td className="text-muted-foreground">{decision.pipeline}</Td>
                <Td>
                  <Badge tone={decision.requiresOcr ? "warning" : "success"}>
                    {decision.requiresOcr ? "Yes" : "No"}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={decision.asyncRequired ? "warning" : "success"}>
                    {decision.asyncRequired ? "Yes" : "No"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
          <CardContent className="border-t border-border text-sm text-muted-foreground">
            <p>
              Rule: OCR and background processing are only introduced when a
              specific operation genuinely requires them. Direct text
              extraction is preferred for selectable PDFs, TXT, DOCX, HTML and
              structured data.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </Container>
  );
}
