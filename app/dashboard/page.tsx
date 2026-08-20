"use client";

import { useState, useEffect } from "react";
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
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/context";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { LAB_COUNT } from "@/lib/labs/registry";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";

const popular = [
  "contract-watchdog",
  "privacy-policy-auditor",
  "salary-slip-analyzer",
  "bank-statement-analyzer",
  "scam-detector",
  "resume-auditor",
];

export default function DashboardPage() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [auditCount, setAuditCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [auditResult, reportResult] = await Promise.all([
          supabase.from("audit_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("audit_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);
        setAuditCount(auditResult.count ?? 0);
        setReportCount(reportResult.count ?? 0);
      } catch {
        // Stats load failed — show zeros
      }
    }
    loadStats();
  }, []);

  const popularTools = TOOL_REGISTRY.filter((t) => popular.includes(t.slug));
  const credits = profile?.credits ?? 0;

  const stats = [
    { label: "Audits completed", value: String(auditCount), icon: FileCheck2, href: "/history" },
    { label: "Reports saved", value: String(reportCount), icon: History, href: "/reports" },
    { label: "Credits available", value: String(credits), icon: Wallet, href: "/wallet" },
    { label: "StoryVerse works", value: "0", icon: ShieldCheck, href: "/storyverse" },
  ];

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Dashboard"
          description={`Welcome back, ${profile?.display_name || "there"}. Your audit workspace at a glance.`}
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
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
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
                          <p className="truncate text-sm font-medium text-foreground">{tool.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{tool.category}</p>
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
                  <Link href="/history" className="text-sm font-medium text-primary hover:underline">
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
              <CardHeader title="Your plan" subtitle={`${profile?.plan ?? "Free"} plan`} />
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Credit balance</span>
                  <span className="text-sm font-medium text-foreground">{credits} credits</span>
                </div>
                <ProgressBar value={Math.min(100, credits)} label="Credit balance" />
                <div className="flex gap-2">
                  <Link href="/pricing" className="flex-1">
                    <Button variant="outline" className="w-full">Upgrade plan</Button>
                  </Link>
                  <Link href="/checkout" className="flex-1">
                    <Button className="w-full">
                      <CreditCard className="h-4 w-4" /> Buy credits
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
                  <Link href="/labs" className="text-sm font-medium text-primary hover:underline">Visit</Link>
                }
              />
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Try experimental AI capabilities before they graduate into stable tools.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="StoryVerse" subtitle="Community publishing" />
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Write collaboratively, vote on canon, and publish stories with the community.
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
          description="Choose a tool from the catalog to begin."
          footer={
            <>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Link href={docName.trim() ? `/tools/${docName.trim().toLowerCase().replace(/\s+/g, "-")}` : "/tools"}>
                <Button onClick={() => setCreateOpen(false)}>Continue to tool</Button>
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
            <Badge tone="neutral">{TOOL_REGISTRY.length} tools available</Badge>
          </div>
        </Dialog>
      </Container>
    </RequireAuth>
  );
}
