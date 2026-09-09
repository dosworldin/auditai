"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { CreditCard, Loader2, QrCode, ShieldCheck, Upload, CheckCircle2, Globe, AlertCircle } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { RequireAuth } from "@/components/auth/RequireAuth";

interface CreditPack {
  label: string;
  credits: number;
  price: number;
}

interface PaymentsConfig {
  paypal: { enabled: boolean; ready: boolean };
  custom: {
    enabled: boolean;
    displayName: string;
    currency: string;
    instructions: string[];
    hasQr: boolean;
  };
}

const DEFAULT_PACKS: CreditPack[] = [
  { label: "Starter Pack", credits: 100, price: 4.99 },
  { label: "Pro Pack", credits: 400, price: 14.99 },
  { label: "Business Pack", credits: 1000, price: 29.99 },
];

type Gateway = "paypal" | "custom" | null;

export default function CheckoutPage() {
  const [packs, setPacks] = useState<CreditPack[]>(DEFAULT_PACKS);
  const [selected, setSelected] = useState<string>("");
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [gateway, setGateway] = useState<Gateway>(null);

  // Custom gateway state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [referenceNote, setReferenceNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPack = packs.find((p) => p.label === selected) ?? null;

  // Load packs + payment config
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [packsRes, configRes] = await Promise.all([
          fetch("/api/pricing/credit-packs"),
          fetch("/api/payments/config"),
        ]);
        if (packsRes.ok) {
          const data = await packsRes.json();
          if (!cancelled && Array.isArray(data.packs) && data.packs.length > 0) {
            setPacks(data.packs);
            setSelected((prev) => prev || data.packs[0].label);
          }
        }
        if (configRes.ok) {
          const data = await configRes.json();
          if (!cancelled) setConfig(data);
        }
      } catch {
        // defaults remain
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected && packs.length > 0) setSelected(packs[0].label);
  }, [packs, selected]);

  const paypalAvailable = Boolean(config?.paypal.enabled && config.paypal.ready);
  const customAvailable = Boolean(config?.custom.enabled);
  const noGatewayAvailable = !loadingConfig && !paypalAvailable && !customAvailable;

  // Fetch QR when custom gateway selected
  const loadQr = useCallback(async () => {
    if (!selectedPack || gateway !== "custom" || !config?.custom.hasQr) return;
    setQrLoading(true);
    try {
      const params = new URLSearchParams({
        amount: String(selectedPack.price),
        note: `AuditAI ${selectedPack.label}`,
      });
      const res = await fetch(`/api/payments/qr?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQrDataUrl(data.qrDataUrl);
      } else {
        setQrDataUrl(null);
      }
    } catch {
      setQrDataUrl(null);
    } finally {
      setQrLoading(false);
    }
  }, [selectedPack, gateway, config?.custom.hasQr]);

  useEffect(() => {
    if (gateway === "custom") loadQr();
  }, [gateway, loadQr]);

  const submitManualPayment = async () => {
    if (!selectedPack || !proofFile) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const form = new FormData();
      form.set("packageLabel", selectedPack.label);
      form.set("credits", String(selectedPack.credits));
      form.set("amount", String(selectedPack.price));
      form.set("referenceNote", referenceNote);
      form.set("proof", proofFile);

      const res = await fetch("/api/payments/manual-request", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setSubmitResult({
          ok: true,
          message: "Payment proof submitted! Admin will verify it and your credits will be added shortly.",
        });
        setProofFile(null);
        setReferenceNote("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setSubmitResult({ ok: false, message: data.error || "Submission failed. Please try again." });
      }
    } catch {
      setSubmitResult({ ok: false, message: "Submission failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Checkout"
          description="Buy a credit pack to top up your account."
          icon={<CreditCard className="h-5 w-5" />}
          breadcrumbs={[{ label: "Pricing", href: "/pricing" }, { label: "Checkout" }]}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Credit pack" subtitle="One-time top-ups" />
              <CardContent className="space-y-3">
                {packs.map((pack) => (
                  <button
                    key={pack.label}
                    type="button"
                    onClick={() => setSelected(pack.label)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 transition-colors ${
                      selected === pack.label
                        ? "border-primary bg-accent/40"
                        : "border-border bg-background hover:bg-secondary/50"
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{pack.label}</p>
                      <p className="text-sm text-muted-foreground">{pack.credits} credits</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-foreground">${pack.price.toFixed(2)}</span>
                      <Badge tone={selected === pack.label ? "primary" : "neutral"}>
                        {selected === pack.label ? "Selected" : "Select"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {loadingConfig ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : noGatewayAvailable ? (
              <Card>
                <CardContent className="flex items-start gap-3 py-6">
                  <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">No payment methods available yet</p>
                    <p className="mt-1">
                      Online payment is being set up. Please check back soon — or contact support if you
                      need credits urgently.
                    </p>
                    <Link href="/support" className="mt-2 inline-block font-medium text-primary hover:underline">
                      Contact support
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader title="Payment method" subtitle="Choose how you want to pay" />
                <CardContent className="space-y-3">
                  {paypalAvailable ? (
                    <button
                      type="button"
                      onClick={() => setGateway("paypal")}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 transition-colors ${
                        gateway === "paypal"
                          ? "border-primary bg-accent/40"
                          : "border-border bg-background hover:bg-secondary/50"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <Globe className="h-4 w-4 text-muted-foreground" /> PayPal
                      </span>
                      <Badge tone={gateway === "paypal" ? "primary" : "neutral"}>
                        {gateway === "paypal" ? "Selected" : "Select"}
                      </Badge>
                    </button>
                  ) : null}

                  {customAvailable ? (
                    <button
                      type="button"
                      onClick={() => setGateway("custom")}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 transition-colors ${
                        gateway === "custom"
                          ? "border-primary bg-accent/40"
                          : "border-border bg-background hover:bg-secondary/50"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                        {config?.custom.displayName ?? "Bank / UPI Transfer"}
                        <Badge tone="info">India</Badge>
                      </span>
                      <Badge tone={gateway === "custom" ? "primary" : "neutral"}>
                        {gateway === "custom" ? "Selected" : "Select"}
                      </Badge>
                    </button>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* --- PayPal flow --- */}
            {gateway === "paypal" && selectedPack ? (
              <Card className="animate-fade-in">
                <CardHeader
                  title="Pay with PayPal"
                  subtitle={`$${selectedPack.price.toFixed(2)} for ${selectedPack.credits} credits`}
                />
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You will be redirected to PayPal to complete the payment securely. Credits are
                    added to your account automatically after payment confirmation.
                  </p>
                  <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">
                    PayPal checkout is being activated on this account. If you have already paid via
                    PayPal, contact support with your transaction ID and your credits will be added
                    after verification.
                  </div>
                  <Link href="/support">
                    <Button variant="outline">
                      <ShieldCheck className="h-4 w-4" /> Report a PayPal payment
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : null}

            {/* --- Custom manual flow (QR + proof upload) --- */}
            {gateway === "custom" && selectedPack ? (
              <Card className="animate-fade-in">
                <CardHeader
                  title={config?.custom.displayName ?? "Bank / UPI Transfer"}
                  subtitle={`Pay ${config?.custom.currency ?? "INR"} equivalent of $${selectedPack.price.toFixed(2)} and upload the payment proof`}
                />
                <CardContent className="space-y-5">
                  {(config?.custom.instructions?.length ?? 0) > 0 ? (
                    <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      <p className="mb-2 font-medium text-foreground">Payment instructions</p>
                      <ol className="list-decimal space-y-1 pl-4">
                        {config!.custom.instructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background p-4">
                      {qrLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : qrDataUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrDataUrl} alt="Payment QR code" className="h-48 w-48 rounded-lg" />
                          <p className="mt-2 text-xs text-muted-foreground">
                            Scan with any UPI app
                          </p>
                        </>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground">
                          QR code is not configured. Use the bank details in the instructions above.
                        </p>
                      )}
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-muted-foreground">Pack</p>
                        <p className="font-medium text-foreground">
                          {selectedPack.label} — {selectedPack.credits} credits
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium text-foreground">
                          ${selectedPack.price.toFixed(2)} ({config?.custom.currency ?? "INR"} equivalent)
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use the exact amount while paying so admin can match your transaction.
                      </p>
                    </div>
                  </div>

                  <Field label="Transaction reference (optional)" help="UPI transaction ID, bank reference number, or sender name.">
                    <Input
                      placeholder="e.g. UPI ref 4321xxxx or NEFT ref"
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                    />
                  </Field>

                  <Field label="Payment proof" help="Screenshot or PDF receipt (max 5 MB). Required.">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                      className="block w-full cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                    />
                  </Field>

                  {submitResult ? (
                    <div
                      className={`rounded-xl border p-4 text-sm animate-fade-in ${
                        submitResult.ok
                          ? "border-success/30 bg-success/5 text-foreground"
                          : "border-destructive/30 bg-destructive/5 text-destructive"
                      }`}
                      role="status"
                    >
                      <span className="inline-flex items-center gap-2">
                        {submitResult.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {submitResult.message}
                      </span>
                    </div>
                  ) : null}

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={submitManualPayment}
                    loading={submitting}
                    disabled={!proofFile || submitting || Boolean(submitResult?.ok)}
                  >
                    <Upload className="h-4 w-4" /> Submit payment proof
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Your credits are added manually after admin verification — usually within a few
                    hours. You can track the status from the wallet page.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Order summary" />
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pack</span>
                  <span className="font-medium text-foreground">{selectedPack?.label ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credits</span>
                  <span className="font-medium text-foreground">{selectedPack?.credits ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium capitalize text-foreground">
                    {gateway === "paypal" ? "PayPal" : gateway === "custom" ? (config?.custom.displayName ?? "Manual") : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">
                    ${selectedPack?.price.toFixed(2) ?? "0.00"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">After payment</p>
                <p>Credits are added to your account after verification.</p>
                <p>Usable across audit tools, Labs, and StoryVerse.</p>
              </CardContent>
            </Card>

            <Link href="/pricing" className="block">
              <Button variant="outline" className="w-full">
                Back to pricing
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
