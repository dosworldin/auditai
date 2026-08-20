"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Banknote, Wallet } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import { WALLET_ENTRIES } from "@/lib/storyverse/data";
import { cn } from "@/lib/utils";

export default function StoryVerseWalletPage() {
  const [pending, setPending] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="StoryVerse Wallet"
        description="Track your earnings, purchases, and payout eligibility as a StoryVerse author."
        icon={<Wallet className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: "Wallet" },
        ]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Wallet data shown is from the in-memory StoryVerse engine store.
          Revenue splits: Book sales 30/70 (Platform/Authors), Paid Voting 70/30 (Platform/Authors).
          Payments and real payout processing remain for future phases.
        </BlueprintNote>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Available balance
            </p>
            <p className="mt-1 text-3xl font-extrabold text-foreground">$84.41</p>
            <p className="mt-1 text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Lifetime earnings
            </p>
            <p className="mt-1 text-3xl font-extrabold text-success">$296.80</p>
            <p className="mt-1 text-xs text-muted-foreground">Across 3 published works</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Pending payout
            </p>
            <p className="mt-1 text-3xl font-extrabold text-warning">$50.00</p>
            <p className="mt-1 text-xs text-muted-foreground">Awaiting withdrawal approval</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Transaction history"
              subtitle="Earnings, purchases and withdrawals"
            />
            <Table
              head={
                <>
                  <Th>Description</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Amount</Th>
                </>
              }
            >
              {WALLET_ENTRIES.map((entry) => (
                <tr key={entry.id}>
                  <Td className="font-medium text-foreground">
                    {entry.description}
                  </Td>
                  <Td className="text-muted-foreground">{entry.date}</Td>
                  <Td
                    className={cn(
                      "text-right font-semibold",
                      entry.amount.startsWith("+")
                        ? "text-success"
                        : "text-foreground",
                    )}
                  >
                    {entry.amount}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Payout" />
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Withdrawals require a verified payout method. Minimum payout:
                $10.00.
              </div>
              <Button
                variant={pending ? "outline" : "primary"}
                className="w-full"
                onClick={() => setPending(true)}
              >
                <Banknote className="h-4 w-4" /> Request withdrawal
              </Button>
              {pending ? (
                <p className="text-sm text-warning animate-fade-in">
                  Blueprint: withdrawal requested (simulated). Payouts land in a
                  future phase.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Revenue rules" />
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Publication revenue is shared with the primary author.</p>
              <p>Canon contributors earn attribution-based bonuses.</p>
              <p>Readers can purchase chapters and full works.</p>
              <p>
                Precise share rules are documented in a future phase.
              </p>
            </CardContent>
          </Card>

          <Link href="/storyverse/marketplace">
            <Button variant="outline" className="w-full">
              <ArrowUpRight className="h-4 w-4" /> Browse marketplace
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
