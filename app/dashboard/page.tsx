"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileCheck2,
  FlaskConical,
  History,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ProgressBar } from "@/components/ui/Feedback";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { LAB_COUNT } from "@/lib/labs/registry";

const stats = [
  { label: "Audits completed", value: "0", icon: FileCheck2, href: "/history" },
  { label: "Reports saved", value: "0", icon: History, href: "/reports" },
  { label: "Credits available", value: "0", icon: Wallet, href: "/wallet" },
  { label: "StoryVerse works", value: "0", icon: ShieldCheck, href: "/storyverse" },
];

const popular = [
  "contract-watchdog",
  "privacy-policy-auditor",
  "salary-slip-analyzer",
  "bank-statement-analyzer",
  "scam-detector",
  "resume-auditor",
];

export default function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [docName, setDocName] = useState("");

  const popularTools = TOOL_REGISTRY.filter((t) => popular.includes(t.slug));

  return (
    <Container className="py-8">
      <PageHeader
        title="Dashboard"
        description="Your audit workspace at a glance."
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New audit
            </Button>
            <Link href="/tools">
              <Button>
                Browse tools <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card interactive>
              <CardContent className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <stat.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Quick start"
              subtitle="Pick a popular tool or browse the full catalog"
            />
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {popularTools.map((tool) => (
                  <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-ring/60 hover:bg-secondary/50">
                      <ToolIcon icon={tool.icon} accentKey={tool.accent} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tool.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tool.category}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Recent audits"
              subtitle="Your audit history appears here after your first run"
              actions={
                <Link
                  href="/history"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              }
            />
            <CardContent>
              <EmptyState
                title="No audits yet"
                description="Run your first audit to see your history, risk scores, and saved reports here."
                action={
                  <Link href="/tools">
                    <Button size="sm">Run an audit</Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your plan" subtitle="Free plan - blueprint" />
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Monthly credit usage
                </span>
                <span className="text-sm font-medium text-foreground">0 / 100</span>
              </div>
              <ProgressBar value={0} label="Free plan quota" />
              <div className="flex gap-2">
                <Link href="/pricing" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Upgrade plan
                  </Button>
                </Link>
                <Link href="/checkout" className="flex-1">
                  <Button className="w-full">
                    <CreditCard className="h-4 w-4" /> Checkout
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Labs"
              subtitle={`${LAB_COUNT} experimental modules`}
              actions={
                <Link href="/labs" className="text-sm font-medium text-primary hover:underline">
                  Visit
                </Link>
              }
            />
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Try experimental AI capabilities before they graduate into stable
                tools. Expect rough edges.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="StoryVerse" subtitle="Community publishing" />
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Write collaboratively, vote on canon, and publish stories with
                the community.
              </p>
              <Link href="/storyverse">
                <Button variant="secondary" className="mt-3 w-full">
                  <FlaskConical className="h-4 w-4" /> Open StoryVerse
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New audit"
        description="Choose a tool from the catalog to begin. Business logic comes in a later phase."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Link href={docName.trim() ? `/tools/${docName.trim().toLowerCase().replace(/\s+/g, "-")}` : "/tools"}>
              <Button
                onClick={() => {
                  setCreateOpen(false);
                }}
              >
                Continue to tool
              </Button>
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            placeholder="Type a tool name to jump to it..."
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Tip: browse the catalog at{" "}
            <Link href="/tools" className="text-primary hover:underline">
              /tools
            </Link>{" "}
            for the full list of tools.
          </p>
          <Badge tone="neutral">40 tools available</Badge>
        </div>
      </Dialog>
    </Container>
  );
}
