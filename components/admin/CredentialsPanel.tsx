"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw, Save, KeyRound, RotateCcw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Field";

interface EnvEntry {
  key: string;
  label: string;
  group: string;
  kind: "secret" | "config";
  where?: string;
  placeholder?: string;
  source: "db" | "env" | "unset";
  db_override: boolean;
  preview: string;
  masked: boolean;
}

export function CredentialsPanel() {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ key: string; text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/env");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string) => {
    const value = (drafts[key] ?? "").trim();
    if (!value) return;
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ key, text: "Saved — live immediately", ok: true });
        setDrafts((d) => ({ ...d, [key]: "" }));
      } else {
        setMessage({ key, text: data.error ?? "Save failed", ok: false });
      }
    } catch {
      setMessage({ key, text: "Save failed — check connection", ok: false });
    } finally {
      setBusy(null);
      load();
    }
  };

  const reveal = async (key: string) => {
    if (revealed[key]) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
      return;
    }
    setBusy(key);
    try {
      const res = await fetch(`/api/admin/env?reveal=${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRevealed((r) => ({ ...r, [key]: data.value ?? "" }));
    } finally {
      setBusy(null);
    }
  };

  const reset = async (key: string) => {
    setBusy(key);
    try {
      await fetch(`/api/admin/env?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    } finally {
      setBusy(null);
      setRevealed((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
      load();
    }
  };

  const groups = entries.reduce<Record<string, EnvEntry[]>>((acc, e) => {
    (acc[e.group] ??= []).push(e);
    return acc;
  }, {});

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="API Credentials & Configuration"
          subtitle="Secrets saved here override deployment env vars instantly — no redeploy needed. Values are stored server-side and shown masked."
        />
        <CardContent className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh status
          </Button>
          <span className="text-xs text-muted-foreground">
            <Badge tone="primary">DB</Badge> set in admin · <Badge tone="neutral">ENV</Badge> from deployment · <Badge tone="warning">unset</Badge>
          </span>
        </CardContent>
      </Card>

      {Object.entries(groups).map(([group, items]) => (
        <Card key={group}>
          <CardHeader title={group} />
          <CardContent className="space-y-5">
            {items.map((e) => (
              <div key={e.key} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium text-foreground">{e.key}</span>
                  <Badge tone={e.source === "db" ? "primary" : e.source === "env" ? "neutral" : "warning"}>
                    {e.source === "db" ? "DB" : e.source === "env" ? "ENV" : "unset"}
                  </Badge>
                  {e.kind === "secret" && <Badge tone="info">secret</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.label}
                  {e.where ? ` · get it from: ${e.where}` : e.placeholder ? ` · default: ${e.placeholder}` : ""}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {revealed[e.key] ? (
                    <code className="max-w-full break-all rounded-md bg-muted px-2 py-1 text-xs">{revealed[e.key]}</code>
                  ) : (
                    <code className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {e.preview || "— not set —"}
                    </code>
                  )}
                  {e.kind === "secret" && (
                    <Button variant="ghost" size="sm" onClick={() => reveal(e.key)} disabled={busy === e.key || e.source === "unset"}>
                      {revealed[e.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {revealed[e.key] ? "Hide" : "Reveal"}
                    </Button>
                  )}
                  {e.db_override && (
                    <Button variant="ghost" size="sm" onClick={() => reset(e.key)} disabled={busy === e.key}>
                      <RotateCcw className="h-4 w-4" /> Reset to env
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    className="min-w-[260px] flex-1"
                    placeholder={`New value for ${e.key}${e.placeholder ? ` (e.g. ${e.placeholder})` : ""}`}
                    value={drafts[e.key] ?? ""}
                    onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                  />
                  <Button size="sm" onClick={() => save(e.key)} disabled={busy === e.key || !(drafts[e.key] ?? "").trim()}>
                    {busy === e.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                  </Button>
                </div>

                {message?.key === e.key && (
                  <p className={`mt-2 text-xs ${message.ok ? "text-success" : "text-destructive"}`}>{message.text}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
