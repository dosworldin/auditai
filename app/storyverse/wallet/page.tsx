"use client";

import { useState, useEffect } from "react";
import { Coins, Loader2, Wallet, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Table, Td, Th } from "@/components/ui/Table";
import { RequireAuth } from "@/components/auth/RequireAuth";

interface WalletData {
  total_earned: number;
  pending_balance: number;
  available_balance: number;
  total_payouts: number;
  transactions: Array<{
    type: string;
    amount: number;
    description: string;
    storyId?: string;
    created_at: string;
  }>;
}

export default function StoryVerseWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  // Payout request form state
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("upi");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");
  const [payoutError, setPayoutError] = useState("");

  const loadWallet = () => {
    fetch("/api/storyverse/wallet")
      .then((res) => res.json())
      .then((data) => setWallet(data.wallet))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadWallet(); }, []);

  const submitPayout = async () => {
    setPayoutError("");
    setPayoutMessage("");
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayoutError("Enter a valid amount.");
      return;
    }
    if (!accountIdentifier.trim()) {
      setPayoutError(payoutMethod === "upi" ? "Enter your UPI ID." : "Enter your account details.");
      return;
    }
    setPayoutSubmitting(true);
    try {
      const res = await fetch("/api/storyverse/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: payoutMethod,
          accountIdentifier: accountIdentifier.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Payout request failed.");
      setPayoutMessage("Payout request submitted — an admin will review it shortly.");
      setShowPayoutForm(false);
      setPayoutAmount("");
      setAccountIdentifier("");
      loadWallet();
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Payout request failed.");
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const available = wallet?.available_balance ?? 0;

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="Author Wallet"
          description="Track your StoryVerse earnings, revenue shares, and payouts."
          icon={<Wallet className="h-5 w-5" />}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="text-center">
                    <p className="text-xs uppercase text-muted-foreground">Total earned</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">${(wallet?.total_earned ?? 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="text-center">
                    <p className="text-xs uppercase text-muted-foreground">Available</p>
                    <p className="mt-1 text-2xl font-bold text-success">${available.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="text-center">
                    <p className="text-xs uppercase text-muted-foreground">Pending</p>
                    <p className="mt-1 text-2xl font-bold text-warning">${(wallet?.pending_balance ?? 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader title="Recent transactions" />
                {(wallet?.transactions ?? []).length > 0 ? (
                  <Table head={<><Th>Type</Th><Th>Description</Th><Th className="text-right">Amount</Th></>}>
                    {(wallet?.transactions ?? []).slice(0, 20).map((tx, i) => (
                      <tr key={i}>
                        <Td className="text-sm">{tx.type}</Td>
                        <Td className="text-sm text-muted-foreground">{tx.description}</Td>
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
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Request a payout" />
                <CardContent className="space-y-3">
                  {payoutMessage ? (
                    <p className="flex items-center gap-2 text-sm text-success animate-fade-in">
                      <CheckCircle2 className="h-4 w-4" /> {payoutMessage}
                    </p>
                  ) : null}
                  {!showPayoutForm ? (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => setShowPayoutForm(true)}
                        disabled={available <= 0}
                      >
                        <Coins className="h-4 w-4" /> Request payout
                      </Button>
                      {available <= 0 ? (
                        <p className="text-xs text-muted-foreground">
                          You need an available balance before requesting a payout.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-3 animate-fade-in">
                      <Field label="Amount (USD)">
                        <Input
                          type="number"
                          min={1}
                          step="0.01"
                          value={payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value)}
                          placeholder={`Max ${available.toFixed(2)}`}
                        />
                      </Field>
                      <Field label="Method">
                        <Select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
                          <option value="upi">UPI (India)</option>
                          <option value="bank">Bank transfer</option>
                          <option value="paypal">PayPal</option>
                        </Select>
                      </Field>
                      <Field
                        label={payoutMethod === "upi" ? "UPI ID" : payoutMethod === "paypal" ? "PayPal email" : "Account details"}
                      >
                        <Input
                          value={accountIdentifier}
                          onChange={(e) => setAccountIdentifier(e.target.value)}
                          placeholder={payoutMethod === "upi" ? "yourname@upi" : payoutMethod === "paypal" ? "you@example.com" : "Account no. / IFSC"}
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button className="flex-1" onClick={submitPayout} loading={payoutSubmitting}>
                          Submit
                        </Button>
                        <Button variant="outline" onClick={() => { setShowPayoutForm(false); setPayoutError(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {payoutError ? <p className="text-sm text-destructive">{payoutError}</p> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Revenue model" />
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>Book sales: 30% platform / 70% author pool</p>
                  <p>Paid voting: 70% platform / 30% author pool</p>
                  <p>Revenue is distributed per your frozen publication snapshot.</p>
                  <p className="pt-2 text-xs">Payouts are reviewed by admins before being sent. A pending payout locks further requests until reviewed.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Container>
    </RequireAuth>
  );
}
