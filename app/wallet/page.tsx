"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Coins, CreditCard, Loader2, Wallet } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/context";

const CREDIT_PACKS = [
  { label: "Starter Pack", credits: 100, price: 4.99 },
  { label: "Pro Pack", credits: 400, price: 14.99 },
  { label: "Business Pack", credits: 1000, price: 29.99 },
];

interface Transaction {
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function WalletPage() {
  const { profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState("Pro Pack");
  const [topUp, setTopUp] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      try {
        const res = await fetch("/api/storyverse/wallet");
        if (res.ok) {
          const data = await res.json();
          if (data.wallet?.transactions) {
            setTransactions(data.wallet.transactions);
          }
        }
      } catch {
        // Failed
      } finally {
        setLoadingTx(false);
      }
    }
    loadTransactions();
  }, []);

  const credits = profile?.credits ?? 0;
  const selectedPack = CREDIT_PACKS.find((p) => p.label === selected);
  const usedPercentage = Math.min(100, (credits / 100) * 100);

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
              <CardHeader title="Credit packs" subtitle="One-time top-ups" />
              <CardContent className="space-y-3">
                {CREDIT_PACKS.map((pack) => (
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
                  onClick={() => setTopUp(true)}
                  disabled={topUp}
                >
                  <CreditCard className="h-4 w-4" /> Purchase {selected}
                </Button>
                {topUp && (
                  <p className="text-sm text-success animate-fade-in">
                    Payment processing is coming soon. Credits will be added to your account after payment integration.
                  </p>
                )}
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
