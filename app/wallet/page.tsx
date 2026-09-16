"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Coins, CreditCard, Loader2, Wallet, Gift, Copy, Check, Share2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/context";

interface CreditPack {
  label: string;
  credits: number;
  price: number;
}

interface Transaction {
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

const FALLBACK_PACKS: CreditPack[] = [
  { label: "Starter Pack", credits: 100, price: 4.99 },
  { label: "Pro Pack", credits: 400, price: 14.99 },
  { label: "Business Pack", credits: 1000, price: 29.99 },
];

export default function WalletPage() {
  const { profile, refreshProfile } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>(FALLBACK_PACKS);
  const [pricingSource, setPricingSource] = useState<"admin" | "default">("default");
  const [selected, setSelected] = useState<string>("");
  const [topUp, setTopUp] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = (profile as unknown as { referral_code?: string } | null)?.referral_code ?? "";
  const inviteUrl = referralCode
    ? `${window.location.origin}/auth?invite=${encodeURIComponent(referralCode)}`
    : "";

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    const text = `Join me on AuditAI with my invite link and get bonus credits when you sign up! ${inviteUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "AuditAI Invite", text, url: inviteUrl });
        return;
      } catch {
        // user dismissed — fall back to copy
      }
    }
    copyInvite();
  };

  // Load runtime pricing from admin settings (server API keeps source of truth).
  useEffect(() => {
    let cancelled = false;
    async function loadPricing() {
      try {
        const res = await fetch("/api/pricing/credit-packs");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.packs) && data.packs.length > 0) {
            setPacks(data.packs);
            setPricingSource("admin");
            setSelected(data.packs[0]?.label ?? "");
            return;
          }
        }
      } catch {
        // fall through to defaults
      }
      if (!cancelled) {
        setSelected(FALLBACK_PACKS[0].label);
      }
    }
    loadPricing();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load real transactions from the credit ledger.
  useEffect(() => {
    let cancelled = false;
    async function loadTransactions() {
      try {
        const res = await fetch("/api/wallet/transactions");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setTransactions(data.transactions ?? []);
          }
        }
      } catch {
        // keep empty
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    }
    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, []);

  const credits = profile?.credits ?? 0;
  const selectedPack = packs.find((p) => p.label === selected);
  // Gauge fills relative to the largest available pack size.
  const maxPackCredits = Math.max(...packs.map((p) => p.credits), 100);
  const usedPercentage = Math.min(100, Math.round((credits / maxPackCredits) * 100));

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Wallet"
          description="Your credits and platform usage."
          icon={<Wallet className="h-5 w-5" />}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Available credits
                    </p>
                    <p className="mt-1 text-4xl font-extrabold text-foreground">{credits}</p>
                  </div>
                  <Coins className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="mt-5">
                  <ProgressBar value={usedPercentage} label={`Credit balance: ${credits} credits`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Credit packs"
                subtitle={
                  pricingSource === "admin"
                    ? "One-time top-ups (pricing set by admin)"
                    : "One-time top-ups (default pricing)"
                }
              />
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
                <Button
                  className="w-full"
                  onClick={() => {
                    if (selectedPack) {
                      window.location.href = `/checkout?pack=${encodeURIComponent(selectedPack.label)}`;
                    }
                  }}
                  disabled={!selectedPack}
                >
                  <CreditCard className="h-4 w-4" /> Purchase {selectedPack?.label ?? ""}
                </Button>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll complete the payment securely at checkout via the available gateways.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Recent transactions" />
              {loadingTx ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length > 0 ? (
                <Table head={<><Th>Item</Th><Th className="text-right">Amount</Th></>}>
                  {transactions.slice(0, 10).map((tx, i) => (
                    <tr key={i}>
                      <Td className="text-sm text-foreground">{tx.description || tx.type}</Td>
                      <Td className={`text-right text-sm font-medium ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                      </Td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <CardContent className="text-sm text-muted-foreground">No transactions yet.</CardContent>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Invite & Earn"
                subtitle="Share your link — they get bonus credits, you get a reward when they sign up."
              />
              <CardContent className="space-y-3">
                {referralCode ? (
                  <>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <Gift className="h-4 w-4 shrink-0 text-primary" />
                      <code className="flex-1 truncate font-mono text-sm font-semibold text-foreground">{referralCode}</code>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={copyInvite} disabled={!inviteUrl}>
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied!" : "Copy link"}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={shareInvite} disabled={!inviteUrl}>
                        <Share2 className="h-4 w-4" /> Share
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Anyone who signs up through your link gets extra welcome credits — and you get credits too.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Your invite link will appear here after your profile loads.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Credit usage" />
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Each tool run consumes credits based on its tier.</p>
                <p>Deep reviews and larger documents cost more credits.</p>
                <p>Free tools may have promotional free uses.</p>
              </CardContent>
            </Card>

            <Link href="/pricing">
              <Button variant="outline" className="w-full">Compare plans</Button>
            </Link>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
