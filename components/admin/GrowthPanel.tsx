"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Copy, Check, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Field";
import { Table, Td, Th } from "@/components/ui/Table";

interface InviteRow {
  code: string;
  type: "invite" | "open";
  max_uses: number | null;
  uses: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  owner_email: string | null;
}

export function GrowthPanel() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Create form
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<"invite" | "open">("invite");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newNote, setNewNote] = useState("");

  // Settings
  const [viaLinkBonus, setViaLinkBonus] = useState("100");
  const [inviterBonus, setInviterBonus] = useState("100");
  const [settingsMsg, setSettingsMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      if (res.ok) setInvites((await res.json()).invites ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.settings?.growth ?? {};
        setViaLinkBonus(String(s.referral_bonus_credits ?? 100));
        setInviterBonus(String(s.referral_inviter_bonus_credits ?? 100));
      }
    } catch { /* defaults */ }
  }, []);

  useEffect(() => { load(); loadSettings(); }, [load, loadSettings]);

  const create = async () => {
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/admin/invites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          code: newCode.trim() || undefined,
          max_uses: newMaxUses.trim() ? Number(newMaxUses) : null,
          note: newNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewCode("");
        setNewMaxUses("");
        setNewNote("");
        load();
      } else {
        setError(data.error ?? "Create failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (code: string, isActive: boolean) => {
    setBusy(code);
    try {
      await fetch("/api/admin/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, is_active: isActive }),
      });
      load();
    } finally { setBusy(null); }
  };

  const remove = async (code: string) => {
    setBusy(code);
    try {
      await fetch(`/api/admin/invites?code=${encodeURIComponent(code)}`, { method: "DELETE" });
      load();
    } finally { setBusy(null); }
  };

  const saveSettings = async () => {
    setSettingsMsg("");
    try {
      const a = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "referral_bonus_credits", value: Number(viaLinkBonus) }),
      });
      const b = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "referral_inviter_bonus_credits", value: Number(inviterBonus) }),
      });
      setSettingsMsg(a.ok && b.ok ? "Saved — applies to new signups immediately" : "Save failed");
    } catch {
      setSettingsMsg("Save failed");
    }
    setTimeout(() => setSettingsMsg(""), 3000);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/auth?invite=${code}`);
    } catch { /* ignore */ }
  };

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
          title="Referral Rewards"
          subtitle="Tiered model: a direct signup gets the base welcome bonus. A signup through a shared link or coupon gets the bigger bonus below — and the inviter earns their own reward."
        />
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Via link/coupon — new user bonus (credits)" help="On top of the base signup bonus">
              <Input type="number" min={0} value={viaLinkBonus} onChange={(e) => setViaLinkBonus(e.target.value)} />
            </Field>
            <Field label="Inviter reward (credits)" help="Paid to the code owner when someone joins">
              <Input type="number" min={0} value={inviterBonus} onChange={(e) => setInviterBonus(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveSettings}>Save rewards</Button>
            {settingsMsg && <span className="text-xs text-muted-foreground">{settingsMsg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Create Invite / Coupon Code" subtitle="Invite codes belong to you (you earn the inviter reward). Open coupons are pure promotions — only the new user gets the bonus." />
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={newType}
                onChange={(e) => setNewType(e.target.value as "invite" | "open")}
              >
                <option value="invite">Invite (you earn)</option>
                <option value="open">Open coupon (promo)</option>
              </select>
            </Field>
            <Field label="Code (optional)" help="Leave empty to auto-generate">
              <Input placeholder="e.g. DIWALI100" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
            </Field>
            <Field label="Max uses (optional)" help="Empty = unlimited">
              <Input type="number" min={1} placeholder="∞" value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (optional)">
            <Input placeholder="e.g. Campaign for college ambassadors" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={create} disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create code
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={`Invite Codes (${invites.length})`} />
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No codes yet — create one above.</p>
          ) : (
            <Table head={<><Th>Code</Th><Th>Type</Th><Th>Uses</Th><Th>Status</Th><Th className="text-right">Actions</Th></>}>
              {invites.map((inv) => (
                <tr key={inv.code}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-muted-foreground" />
                      <code className="font-mono text-sm font-semibold">{inv.code}</code>
                      <button
                        type="button"
                        onClick={() => copyCode(inv.code)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy invite link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {inv.note && <p className="mt-0.5 text-xs text-muted-foreground">{inv.note}</p>}
                  </Td>
                  <Td>
                    <Badge tone={inv.type === "open" ? "info" : "primary"}>
                      {inv.type === "open" ? "coupon" : "invite"}
                    </Badge>
                  </Td>
                  <Td className="text-sm">{inv.uses}{inv.max_uses ? ` / ${inv.max_uses}` : ""}</Td>
                  <Td>
                    <Badge tone={inv.is_active ? "success" : "warning"}>{inv.is_active ? "active" : "paused"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggle(inv.code, !inv.is_active)} disabled={busy === inv.code}>
                        {inv.is_active ? "Pause" : "Activate"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(inv.code)} disabled={busy === inv.code}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
