"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Activity, FlaskConical, LayoutGrid, ServerCog, ShieldCheck, Table2, Settings, Loader2, Wallet, CheckCircle2, XCircle, ExternalLink, Users, LifeBuoy, ListChecks, Banknote } from "lucide-react";
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

interface ManualPaymentRequest {
  id: string;
  user_id: string;
  email: string | null;
  package_label: string | null;
  credits: number;
  amount: number;
  currency: string;
  status: string;
  reference_note: string | null;
  proof_storage_path: string | null;
  proofUrl: string | null;
  created_at: string;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const defaultSettings: SettingsData = {
  general: { platform_name: "AuditAI", maintenance_mode: false },
  ai: { ai_primary_provider: "deepseek", ai_fallback_provider: "gemini" },
  billing: { credit_value: 0.10 },
  promotion: { promotion_enabled: true, promotion_uses_per_tool: 1 },
  tools: { tool_prices: {} },
  labs: { lab_prices: {} },
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
  const [payments, setPayments] = useState<ManualPaymentRequest[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentAction, setPaymentAction] = useState<string | null>(null);

  // Users tab state
  interface AdminUserRow {
    id: string; email: string; display_name: string; role: string;
    credits: number; plan: string; country: string | null;
    is_suspended: boolean; suspension_reason: string | null; created_at: string;
  }
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userAction, setUserAction] = useState<string | null>(null);

  // Support tab state
  interface TicketRow { id: string; user_id: string; category: string; subject: string; status: string; priority: string; created_at: string; }
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Requests tab state
  interface AuditReqRow { id: string; user_id: string; tool_name: string; status: string; used_credits: number; created_at: string; }
  interface LabReqRow { id: string; user_id: string; lab_slug: string; status: string; used_credits: number; created_at: string; }
  const [reqData, setReqData] = useState<{ audit: AuditReqRow[]; labs: LabReqRow[] }>({ audit: [], labs: [] });
  const [reqLoading, setReqLoading] = useState(false);

  // Payouts tab state
  interface PayoutRow { id: string; user_id: string; amount: number; currency: string; method: string; status: string; account_identifier: string; created_at: string; email?: string | null; display_name?: string | null; }
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutAction, setPayoutAction] = useState<string | null>(null);

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

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      if (res.ok) {
        const data = await res.json();
        setPayments(data.requests ?? []);
      }
    } catch { /* ignore */ }
    finally { setPaymentsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "payments") loadPayments();
  }, [tab, loadPayments]);

  // --- Tool/Lab credit pricing state ---
  const [toolPrices, setToolPrices] = useState<Record<string, number>>({});
  const [labPrices, setLabPrices] = useState<Record<string, number>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [creditPacksDraft, setCreditPacksDraft] = useState<string>("");

  useEffect(() => {
    if (tab === "tools" || tab === "labs") {
      setToolPrices((settings.tools?.tool_prices as Record<string, number>) ?? {});
      setLabPrices((settings.labs?.lab_prices as Record<string, number>) ?? {});
    }
  }, [tab, settings]);

  // Load credit packs draft when settings arrive or Settings tab opens
  useEffect(() => {
    if (tab === "settings") {
      const packs = settings.billing?.credit_packs;
      setCreditPacksDraft(Array.isArray(packs) ? JSON.stringify(packs, null, 2) : "");
    }
  }, [tab, settings]);

  const saveToolPrice = async (slug: string, fallback: number) => {
    const raw = priceEdits[slug];
    if (raw === undefined) return;
    const next = { ...toolPrices };
    if (raw.trim() === "" || Number(raw) === fallback) {
      delete next[slug]; // back to registry default
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return;
      next[slug] = n;
    }
    setToolPrices(next);
    setPriceEdits((p) => { const q = { ...p }; delete q[slug]; return q; });
    await saveSetting("tool_prices", next);
  };

  const saveLabPrice = async (slug: string, fallback: number) => {
    const raw = priceEdits[slug];
    if (raw === undefined) return;
    const next = { ...labPrices };
    if (raw.trim() === "" || Number(raw) === fallback) {
      delete next[slug];
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return;
      next[slug] = n;
    }
    setLabPrices(next);
    setPriceEdits((p) => { const q = { ...p }; delete q[slug]; return q; });
    await saveSetting("lab_prices", next);
  };

  const loadUsers = useCallback(async (q?: string) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/admin/users${q ? `?query=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab, loadUsers]);

  const updateUser = async (userId: string, updates: Record<string, unknown>) => {
    setUserAction(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...updates }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSaveMessage("User updated");
        setTimeout(() => setSaveMessage(""), 3000);
        loadUsers(userQuery);
      } else {
        setSaveMessage(data?.error || "Update failed");
        setTimeout(() => setSaveMessage(""), 4000);
      }
    } catch {
      setSaveMessage("Update failed");
      setTimeout(() => setSaveMessage(""), 4000);
    } finally { setUserAction(null); }
  };

  const adjustCredits = async (userId: string) => {
    const raw = window.prompt("Credit delta (e.g. 50 to add, -10 to deduct):");
    if (!raw) return;
    const delta = Number(raw);
    if (!Number.isFinite(delta) || delta === 0) {
      setSaveMessage("Enter a non-zero number");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }
    await updateUser(userId, { credits_delta: delta, reason: "Admin panel manual adjustment" });
  };

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets?limit=50");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets ?? []);
      }
    } catch { /* ignore */ }
    finally { setTicketsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "support") loadTickets();
  }, [tab, loadTickets]);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await fetch("/api/admin/requests");
      if (res.ok) {
        const data = await res.json();
        setReqData({ audit: data.auditRequests ?? [], labs: data.labRequests ?? [] });
      }
    } catch { /* ignore */ }
    finally { setReqLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "requests") loadRequests();
  }, [tab, loadRequests]);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await fetch("/api/admin/payouts");
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts ?? []);
      }
    } catch { /* ignore */ }
    finally { setPayoutsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "payouts") loadPayouts();
  }, [tab, loadPayouts]);

  const reviewPayout = async (payoutId: string, action: "approve" | "reject" | "mark_paid") => {
    setPayoutAction(payoutId);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: payoutId, action, reason: action === "reject" ? "Rejected via admin panel" : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSaveMessage(`Payout ${data.status}`);
        setTimeout(() => setSaveMessage(""), 3000);
        loadPayouts();
      } else {
        setSaveMessage(data?.error || "Payout action failed");
        setTimeout(() => setSaveMessage(""), 4000);
      }
    } catch {
      setSaveMessage("Payout action failed");
      setTimeout(() => setSaveMessage(""), 4000);
    } finally { setPayoutAction(null); }
  };

  const reviewPayment = async (requestId: string, action: "approve" | "reject") => {
    setPaymentAction(requestId);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        setSaveMessage(action === "approve" ? "Payment approved — credits granted" : "Payment rejected");
        setTimeout(() => setSaveMessage(""), 3000);
        loadPayments();
      } else {
        const data = await res.json();
        setSaveMessage(data.error || "Review failed");
        setTimeout(() => setSaveMessage(""), 4000);
      }
    } catch {
      setSaveMessage("Review failed");
      setTimeout(() => setSaveMessage(""), 4000);
    } finally {
      setPaymentAction(null);
    }
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
              { id: "payments", label: "Payments", icon: <Wallet className="h-4 w-4" /> },
              { id: "payouts", label: "Payouts", icon: <Banknote className="h-4 w-4" /> },
              { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
              { id: "support", label: "Support", icon: <LifeBuoy className="h-4 w-4" /> },
              { id: "requests", label: "Requests", icon: <ListChecks className="h-4 w-4" /> },
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
                  <CardHeader
                    title="Credit Packs (Wallet/Pricing)"
                    subtitle='Shown on /pricing and /checkout. JSON array: [{"label":"Starter Pack","credits":100,"price":4.99,"tagline":"For occasional audits","featured":false}]'
                  />
                  <CardContent className="space-y-4">
                    <Field
                      label="Packs JSON"
                      help="Leave empty to use built-in defaults. Invalid JSON will not save."
                    >
                      <textarea
                        rows={6}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                        value={creditPacksDraft}
                        onChange={(e) => setCreditPacksDraft(e.target.value)}
                        onBlur={() => {
                          if (!creditPacksDraft.trim()) return;
                          try {
                            const parsed = JSON.parse(creditPacksDraft);
                            if (Array.isArray(parsed)) {
                              saveSetting("credit_packs", parsed);
                            } else {
                              setSaveMessage("Credit packs must be a JSON array");
                              setTimeout(() => setSaveMessage(""), 4000);
                            }
                          } catch {
                            setSaveMessage("Invalid JSON — not saved");
                            setTimeout(() => setSaveMessage(""), 4000);
                          }
                        }}
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

                <Card>
                  <CardHeader title="Payment Gateways" subtitle="Toggle checkout payment methods on/off" />
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">PayPal</p>
                        <p className="text-xs text-muted-foreground">Online payments via PayPal checkout</p>
                      </div>
                      <Toggle
                        checked={Boolean(settings.payments?.payment_paypal_enabled)}
                        onChange={(v) => { updateSetting("payments", "payment_paypal_enabled", v); saveSetting("payment_paypal_enabled", v); }}
                      />
                    </div>
                    <Field
                      label="PayPal mode"
                      help="Sandbox for testing (fake money), Live for real payments. Credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are set as environment variables — they are never stored in the database."
                    >
                      <select
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        value={String(settings.payments?.payment_paypal_mode ?? "sandbox")}
                        onChange={(e) => { updateSetting("payments", "payment_paypal_mode", e.target.value); saveSetting("payment_paypal_mode", e.target.value); }}
                      >
                        <option value="sandbox">Sandbox (test)</option>
                        <option value="live">Live (real money)</option>
                      </select>
                    </Field>
                    <div className="flex items-center justify-between rounded-xl border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">Custom gateway (Bank / UPI + QR)</p>
                        <p className="text-xs text-muted-foreground">Manual transfer with payment proof upload</p>
                      </div>
                      <Toggle
                        checked={Boolean(settings.payments?.payment_custom_enabled)}
                        onChange={(v) => { updateSetting("payments", "payment_custom_enabled", v); saveSetting("payment_custom_enabled", v); }}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">Custom gateway: India only</p>
                        <p className="text-xs text-muted-foreground">Show the custom gateway only to users from India</p>
                      </div>
                      <Toggle
                        checked={Boolean(settings.payments?.payment_custom_india_only ?? true)}
                        onChange={(v) => { updateSetting("payments", "payment_custom_india_only", v); saveSetting("payment_custom_india_only", v); }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Gateway display name">
                        <Input
                          value={String(settings.payments?.payment_custom_display_name ?? "Bank / UPI Transfer")}
                          onChange={(e) => updateSetting("payments", "payment_custom_display_name", e.target.value)}
                          onBlur={() => saveSetting("payment_custom_display_name", settings.payments?.payment_custom_display_name)}
                        />
                      </Field>
                      <Field label="Currency code" help="Shown next to amounts for the custom gateway">
                        <Input
                          value={String(settings.payments?.payment_custom_currency ?? "INR")}
                          onChange={(e) => updateSetting("payments", "payment_custom_currency", e.target.value)}
                          onBlur={() => saveSetting("payment_custom_currency", settings.payments?.payment_custom_currency)}
                        />
                      </Field>
                    </div>
                    <Field
                      label="UPI ID for QR"
                      help="Only the UPI ID is encoded in the QR. Never put bank credentials here."
                    >
                      <Input
                        placeholder="yourname@upi"
                        value={String(settings.payments?.payment_custom_qr_upi_id ?? "")}
                        onChange={(e) => updateSetting("payments", "payment_custom_qr_upi_id", e.target.value)}
                        onBlur={() => saveSetting("payment_custom_qr_upi_id", settings.payments?.payment_custom_qr_upi_id)}
                      />
                    </Field>
                    <Field
                      label="Payment instructions (one per line)"
                      help="Steps shown to users, e.g. bank account number, IFSC, payee name."
                    >
                      <textarea
                        rows={4}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        value={Array.isArray(settings.payments?.payment_custom_instructions)
                          ? (settings.payments.payment_custom_instructions as string[]).join("\n")
                          : ""}
                        onChange={(e) =>
                          updateSetting("payments", "payment_custom_instructions",
                            e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                        onBlur={() => saveSetting("payment_custom_instructions", settings.payments?.payment_custom_instructions)}
                      />
                    </Field>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Manual payment proofs"
                subtitle="Users who paid via bank/UPI and uploaded proof — approve to grant credits"
                actions={
                  <Button variant="outline" size="sm" onClick={loadPayments} disabled={paymentsLoading}>
                    {paymentsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refresh
                  </Button>
                }
              />
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No payment requests yet.</p>
                ) : (
                  <Table head={<><Th>User</Th><Th>Pack</Th><Th>Amount</Th><Th>Reference</Th><Th>Proof</Th><Th>Status</Th><Th className="text-right">Actions</Th></>}>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <Td className="text-sm text-foreground">{p.email ?? p.user_id.slice(0, 8)}</Td>
                        <Td className="text-sm text-muted-foreground">{p.package_label} ({Number(p.credits)} credits)</Td>
                        <Td className="text-sm font-medium text-foreground">{p.currency} {Number(p.amount).toFixed(2)}</Td>
                        <Td><span className="block max-w-[180px] truncate text-sm text-muted-foreground" title={p.reference_note ?? ""}>{p.reference_note ?? "—"}</span></Td>
                        <Td>
                          {p.proofUrl ? (
                            <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={p.status === "approved" ? "success" : p.status === "rejected" ? "destructive" : "warning"}>
                            {p.status}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          {p.status === "submitted" || p.status === "awaiting_proof" ? (
                            <span className="inline-flex justify-end gap-2">
                              <Button size="sm" variant="success" disabled={paymentAction === p.id} onClick={() => reviewPayment(p.id, "approve")}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" disabled={paymentAction === p.id} onClick={() => reviewPayment(p.id, "reject")}>
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </span>
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "tools" && (
          <Card>
            <CardHeader
              title="Tools"
              subtitle="Edit the credit cost per run. Clear a field to restore the default."
            />
            <CardContent>
              <Table head={<><Th>Tool</Th><Th>Category</Th><Th>Inputs</Th><Th>Credits / run</Th><Th>Status</Th></>}>
                {TOOL_REGISTRY.map((tool) => {
                  const effective = toolPrices[tool.slug] ?? tool.pricing.creditsPerRun;
                  const isOverridden = toolPrices[tool.slug] !== undefined;
                  return (
                    <tr key={tool.slug}>
                      <Td><Link href={`/tools/${tool.slug}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"><ToolIcon icon={tool.icon} accentKey={tool.accent} size="sm" />{tool.name}</Link></Td>
                      <Td className="text-muted-foreground">{tool.category}</Td>
                      <Td className="text-muted-foreground">{tool.inputs.length} types</Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={priceEdits[tool.slug] ?? String(effective)}
                            onChange={(e) => setPriceEdits((p) => ({ ...p, [tool.slug]: e.target.value }))}
                            onBlur={() => saveToolPrice(tool.slug, tool.pricing.creditsPerRun)}
                          />
                          {isOverridden ? <Badge tone="info">override</Badge> : <span className="text-xs text-muted-foreground">default {tool.pricing.creditsPerRun}</span>}
                        </span>
                      </Td>
                      <Td><Badge tone="success">Live</Badge></Td>
                    </tr>
                  );
                })}
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "labs" && (
          <Card>
            <CardHeader
              title="Labs"
              subtitle="Edit the credit cost per run. Clear a field to restore the default (1 credit)."
            />
            <CardContent>
              <Table head={<><Th>Module</Th><Th>Category</Th><Th>Status</Th><Th>Credits / run</Th></>}>
                {LAB_REGISTRY.map((lab) => {
                  const effective = labPrices[lab.slug] ?? 1;
                  const isOverridden = labPrices[lab.slug] !== undefined;
                  return (
                    <tr key={lab.slug}>
                      <Td><Link href={`/labs/${lab.slug}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"><ToolIcon icon={lab.icon} accentKey={lab.accent} size="sm" />{lab.name}</Link></Td>
                      <Td className="text-muted-foreground">{lab.category}</Td>
                      <Td><Badge tone={lab.status === "Coming Soon" ? "warning" : "success"}>{lab.status}</Badge></Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={priceEdits[lab.slug] ?? String(effective)}
                            onChange={(e) => setPriceEdits((p) => ({ ...p, [lab.slug]: e.target.value }))}
                            onBlur={() => saveLabPrice(lab.slug, 1)}
                          />
                          {isOverridden ? <Badge tone="info">override</Badge> : <span className="text-xs text-muted-foreground">default 1</span>}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "users" && (
          <Card>
            <CardHeader
              title="Users"
              subtitle="Search, suspend, adjust credits, and change roles"
              actions={
                <div className="flex gap-2">
                  <Input
                    placeholder="Search email or name…"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") loadUsers(userQuery); }}
                    className="w-48"
                  />
                  <Button variant="outline" size="sm" onClick={() => loadUsers(userQuery)} disabled={usersLoading}>
                    {usersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Search
                  </Button>
                </div>
              }
            />
            <CardContent>
              <Table head={<><Th>User</Th><Th>Role</Th><Th>Credits</Th><Th>Plan</Th><Th>Status</Th><Th className="text-right">Actions</Th></>}>
                {users.map((u) => (
                  <tr key={u.id}>
                    <Td>
                      <p className="text-sm font-medium text-foreground">{u.display_name || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}{u.country ? ` · ${u.country}` : ""}</p>
                    </Td>
                    <Td>
                      <select
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        value={u.role}
                        disabled={userAction === u.id}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      >
                        <option value="user">user</option>
                        <option value="support">support</option>
                        <option value="admin">admin</option>
                      </select>
                    </Td>
                    <Td className="text-sm font-medium text-foreground">{Number(u.credits).toFixed(2)}</Td>
                    <Td className="text-sm text-muted-foreground capitalize">{u.plan}</Td>
                    <Td>
                      <Badge tone={u.is_suspended ? "destructive" : "success"}>
                        {u.is_suspended ? "Suspended" : "Active"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={userAction === u.id} onClick={() => adjustCredits(u.id)}>
                          Credits
                        </Button>
                        {u.is_suspended ? (
                          <Button size="sm" variant="success" disabled={userAction === u.id} onClick={() => updateUser(u.id, { is_suspended: false, reason: "Unsuspended by admin" })}>
                            Unsuspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={userAction === u.id} onClick={() => updateUser(u.id, { is_suspended: true, reason: "Suspended via admin panel" })}>
                            Suspend
                          </Button>
                        )}
                      </span>
                    </Td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "support" && (
          <Card>
            <CardHeader
              title="Support tickets"
              subtitle="Open the ticket to reply, add internal notes, or change status/priority"
              actions={
                <Button variant="outline" size="sm" onClick={loadTickets} disabled={ticketsLoading}>
                  {ticketsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refresh
                </Button>
              }
            />
            <CardContent>
              {tickets.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No tickets yet.</p>
              ) : (
                <Table head={<><Th>Subject</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Created</Th><Th className="text-right">Actions</Th></>}>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <Td className="max-w-[280px] truncate text-sm font-medium text-foreground" >{t.subject}</Td>
                      <Td className="text-sm text-muted-foreground">{t.category}</Td>
                      <Td className="text-sm text-muted-foreground capitalize">{t.priority}</Td>
                      <Td>
                        <Badge tone={t.status === "open" ? "warning" : t.status === "resolved" || t.status === "closed" ? "success" : "info"}>
                          {t.status}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</Td>
                      <Td className="text-right">
                        <Link href={`/support/tickets/${t.id}`} className="text-sm font-medium text-primary hover:underline">
                          Open
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "requests" && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Recent audit requests"
                actions={
                  <Button variant="outline" size="sm" onClick={loadRequests} disabled={reqLoading}>
                    {reqLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refresh
                  </Button>
                }
              />
              <CardContent>
                {reqData.audit.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No audit requests yet.</p>
                ) : (
                  <Table head={<><Th>Tool</Th><Th>Status</Th><Th>Credits</Th><Th>Created</Th></>}>
                    {reqData.audit.map((r) => (
                      <tr key={r.id}>
                        <Td className="text-sm font-medium text-foreground">{r.tool_name}</Td>
                        <Td><Badge tone={r.status === "completed" ? "success" : r.status === "failed" ? "destructive" : "warning"}>{r.status}</Badge></Td>
                        <Td className="text-sm text-muted-foreground">{Number(r.used_credits ?? 0).toFixed(2)}</Td>
                        <Td className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Recent lab requests" />
              <CardContent>
                {reqData.labs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No lab requests yet.</p>
                ) : (
                  <Table head={<><Th>Lab</Th><Th>Status</Th><Th>Credits</Th><Th>Created</Th></>}>
                    {reqData.labs.map((r) => (
                      <tr key={r.id}>
                        <Td className="text-sm font-medium text-foreground">{r.lab_slug}</Td>
                        <Td><Badge tone={r.status === "completed" ? "success" : r.status === "failed" ? "destructive" : "warning"}>{r.status}</Badge></Td>
                        <Td className="text-sm text-muted-foreground">{Number(r.used_credits ?? 0).toFixed(2)}</Td>
                        <Td className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "payouts" && (
          <Card>
            <CardHeader
              title="StoryVerse payouts"
              subtitle="Approve, reject (refunds wallet), or mark paid"
              actions={
                <Button variant="outline" size="sm" onClick={loadPayouts} disabled={payoutsLoading}>
                  {payoutsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refresh
                </Button>
              }
            />
            <CardContent>
              {payouts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No payout requests yet.</p>
              ) : (
                <Table head={<><Th>Author</Th><Th>Amount</Th><Th>Method</Th><Th>Account</Th><Th>Status</Th><Th className="text-right">Actions</Th></>}>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <Td className="text-sm text-foreground">{p.display_name || p.email || p.user_id.slice(0, 8)}</Td>
                      <Td className="text-sm font-medium text-foreground">{p.currency} {Number(p.amount).toFixed(2)}</Td>
                      <Td className="text-sm text-muted-foreground capitalize">{p.method}</Td>
                      <Td><span className="block max-w-[160px] truncate text-sm text-muted-foreground" title={p.account_identifier}>{p.account_identifier}</span></Td>
                      <Td>
                        <Badge tone={p.status === "pending" ? "warning" : p.status === "approved" ? "info" : p.status === "paid" ? "success" : "destructive"}>
                          {p.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {p.status === "pending" || p.status === "processing" ? (
                          <span className="inline-flex justify-end gap-2">
                            <Button size="sm" variant="success" disabled={payoutAction === p.id} onClick={() => reviewPayout(p.id, "approve")}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={payoutAction === p.id} onClick={() => reviewPayout(p.id, "reject")}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </span>
                        ) : p.status === "approved" ? (
                          <Button size="sm" variant="success" disabled={payoutAction === p.id} onClick={() => reviewPayout(p.id, "mark_paid")}>
                            Mark paid
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </CardContent>
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
