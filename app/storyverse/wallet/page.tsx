"use client";

import { useState, useEffect } from "react";
import { Coins, Loader2, Wallet } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

  useEffect(() => {
    fetch("/api/storyverse/wallet")
      .then((res) => res.json())
      .then((data) => setWallet(data.wallet))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
                    <p className="mt-1 text-2xl font-bold text-success">${(wallet?.available_balance ?? 0).toFixed(2)}</p>
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
                <CardHeader title="Actions" />
                <CardContent className="space-y-2">
                  <Button className="w-full" variant="outline" disabled>Request payout (coming soon)</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Revenue model" />
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>Book sales: 30% platform / 70% author pool</p>
                  <p>Paid voting: 70% platform / 30% author pool</p>
                  <p>Revenue is distributed per your frozen publication snapshot.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Container>
    </RequireAuth>
  );
}
