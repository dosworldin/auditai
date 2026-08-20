"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Activity, FlaskConical, LayoutGrid, ServerCog, ShieldCheck, Table2, Settings, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Td, Th } from "@/components/ui/Table";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Field";
import { RequireAdmin } from "@/components/auth/RequireAuth";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { LAB_REGISTRY } from "@/lib/labs/registry";
import { PROCESSING_DECISIONS } from "@/lib/processing/blueprint";

interface SettingsGroup { [key: string]: unknown; }
interface SettingsData { [category: string]: SettingsGroup; }

const defaultSettings: SettingsData = {
  general: { platform_name: "AuditAI", maintenance_mode: false },
  ai: { ai_primary_provider: "deepseek", ai_fallback_provider: "gemini" },
  billing: { credit_value: 0.10 },
  promotion: { promotion_enabled: true, promotion_uses_per_tool: 1 },
  storyverse: {
    storyverse_book_platform_percent: 30,
    storyverse_book_author_percent: 70,
    storyverse_vote_platform_percent: 70,
    storyverse_vote_author_percent: 30,
    storyverse_ai_editor_price: 10,
    storyverse_pool_inactivity_hold_days: 7,
  },
};

export default function AdminPage() {
  const [tab, setTab] = useState("overview");
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSetting = async (key: string, value: unknown) => {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setSaveMessage(`Saved ${key}`);
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        const err = await res.json();
        setSaveMessage(err.error || "Save failed");
      }
    } catch {
      setSaveMessage("Save failed — check auth");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category: string, key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [category]: { ...(prev[category] || {}), [key]: value } }));
  };

  const platformStats = [
    { label: "Audit tools", value: TOOL_REGISTRY.length, icon: LayoutGrid },
    { label: "Labs modules", value: LAB_REGISTRY.length, icon: FlaskConical },
    { label: "Routes", value: 45, icon: Activity },
    { label: "Workers", value: 0, icon: ServerCog },
  ];

  return (
    <RequireAdmin>
      <Container className="py-8">
        <PageHeader
          title="Admin Command Center"
          description="Runtime configuration for the AuditAI platform."
          icon={<ShieldCheck className="h-5 w-5" />}
          actions={
            saveMessage ? (
              <Badge tone={saveMessage.includes("failed") ? "destructive" : "success"}>
                {saveMessage}
              </Badge>
            ) : null
          }
        />

        <div className="mb-6">
          <Tabs
            active={tab}
            onChange={setTab}
            items={[
              { id: "overview", label: "Overview", icon: <Activity className="h-4 w-4" /> },
              { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
              { id: "tools", label: "Tools", icon: <LayoutGrid className="h-4 w-4" /> },
              { id: "labs", label: "Labs", icon: <FlaskConical className="h-4 w-4" /> },
              { id: "processing", label: "Processing", icon: <ServerCog className="h-4 w-4" /> },
            ]}
          />
        </div>

        {tab === "overview" && (
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
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-6">
            {loading ? (
              <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader title="General" subtitle="Platform-wide settings" />
                  <CardContent className="space-y-4">
                    <Field label="Platform Name">
                      <Input
                        value={String(settings.general?.platform_name ?? "AuditAI")}
                        onChange={(e) => updateSetting("general", "platform_name", e.target.value)}
                        onBlur={() => saveSetting("platform_name", settings.general?.platform_name)}
                      />
                    </Field>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="AI Providers" />
                  <CardContent className="space-y-4">
                    <Field label="Primary Provider">
                      <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={String(settings.ai?.ai_primary_provider ?? "deepseek")} onChange={(e) => { updateSetting("ai", "ai_primary_provider", e.target.value); saveSetting("ai_primary_provider", e.target.value); }}>
                        <option value="deepseek">DeepSeek</option>
                        <option value="gemini">Gemini</option>
                      </select>
                    </Field>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="StoryVerse Economy" />
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Book: Platform %"><Input type="number" value={String(settings.storyverse?.storyverse_book_platform_percent ?? 30)} onChange={(e) => updateSetting("storyverse", "storyverse_book_platform_percent", Number(e.target.value))} onBlur={() => saveSetting("storyverse_book_platform_percent", settings.storyverse?.storyverse_book_platform_percent)} /></Field>
                      <Field label="Book: Author Pool %"><Input type="number" value={String(settings.storyverse?.storyverse_book_author_percent ?? 70)} onChange={(e) => updateSetting("storyverse", "storyverse_book_author_percent", Number(e.target.value))} onBlur={() => saveSetting("storyverse_book_author_percent", settings.storyverse?.storyverse_book_author_percent)} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="AI Editor Credits"><Input type="number" value={String(settings.storyverse?.storyverse_ai_editor_price ?? 10)} onChange={(e) => updateSetting("storyverse", "storyverse_ai_editor_price", Number(e.target.value))} onBlur={() => saveSetting("storyverse_ai_editor_price", settings.storyverse?.storyverse_ai_editor_price)} /></Field>
                      <Field label="Inactivity Hold Days"><Input type="number" value={String(settings.storyverse?.storyverse_pool_inactivity_hold_days ?? 7)} onChange={(e) => updateSetting("storyverse", "storyverse_pool_inactivity_hold_days", Number(e.target.value))} onBlur={() => saveSetting("storyverse_pool_inactivity_hold_days", settings.storyverse?.storyverse_pool_inactivity_hold_days)} /></Field>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "tools" && (
          <Card>
            <Table head={<><Th>Tool</Th><Th>Category</Th><Th>Inputs</Th><Th>Credits</Th><Th>Status</Th></>}>
              {TOOL_REGISTRY.map((tool) => (
                <tr key={tool.slug}>
                  <Td><Link href={`/tools/${tool.slug}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"><ToolIcon icon={tool.icon} accentKey={tool.accent} size="sm" />{tool.name}</Link></Td>
                  <Td className="text-muted-foreground">{tool.category}</Td>
                  <Td className="text-muted-foreground">{tool.inputs.length} types</Td>
                  <Td className="text-muted-foreground">{tool.pricing.creditsPerRun}</Td>
                  <Td><Badge tone="success">Live</Badge></Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        {tab === "labs" && (
          <Card>
            <Table head={<><Th>Module</Th><Th>Category</Th><Th>Status</Th><Th>Inputs</Th></>}>
              {LAB_REGISTRY.map((lab) => (
                <tr key={lab.slug}>
                  <Td><Link href={`/labs/${lab.slug}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"><ToolIcon icon={lab.icon} accentKey={lab.accent} size="sm" />{lab.name}</Link></Td>
                  <Td className="text-muted-foreground">{lab.category}</Td>
                  <Td><Badge tone={lab.status === "Coming Soon" ? "warning" : "success"}>{lab.status}</Badge></Td>
                  <Td className="text-muted-foreground">{lab.inputs.length} types</Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        {tab === "processing" && (
          <Card>
            <CardHeader title="Input to pipeline mapping" subtitle="OCR is on-demand only" icon={<Table2 className="h-4 w-4" />} />
            <Table head={<><Th>Input type</Th><Th>Pipeline</Th><Th>OCR</Th><Th>Async</Th></>}>
              {PROCESSING_DECISIONS.map((d) => (
                <tr key={d.inputType}>
                  <Td className="font-medium text-foreground">{d.inputType}</Td>
                  <Td className="text-muted-foreground">{d.pipeline}</Td>
                  <Td><Badge tone={d.requiresOcr ? "warning" : "success"}>{d.requiresOcr ? "Yes" : "No"}</Badge></Td>
                  <Td><Badge tone={d.asyncRequired ? "warning" : "success"}>{d.asyncRequired ? "Yes" : "No"}</Badge></Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}
      </Container>
    </RequireAdmin>
  );
}
