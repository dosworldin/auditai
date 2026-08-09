"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, CreditCard, Wallet } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Feedback";
import { Table, Td, Th } from "@/components/ui/Table";

const CREDIT_PACKS = [
  { label: "Starter Pack", credits: 100, price: "$4.99" },
  { label: "Pro Pack", credits: 400, price: "$14.99" },
  { label: "Business Pack", credits: 1000, price: "$29.99" },
];

export default function WalletPage() {
  const [selected, setSelected] = useState("Pro Pack");
  const [topUp, setTopUp] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Wallet"
        description="Buy credit packs and track your platform usage."
        icon={<Wallet className="h-5 w-5" />}
      />

      <div className="mb-6">
        <BlueprintNote>
          Credit balances are illustrative. Billing and payment processing are
          intentionally not implemented in this phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Available credits
                  </p>
                  <p className="mt-1 text-4xl font-extrabold text-foreground">0</p>
                </div>
                <Coins className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="mt-5">
                <ProgressBar value={0} label="Monthly plan quota (0 / 100)" />
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
                    <p className="text-sm text-muted-foreground">
                      {pack.credits} credits
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground">
                      {pack.price}
                    </span>
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
              {topUp ? (
                <p className="text-sm text-success animate-fade-in">
                  Blueprint: purchase simulated. Payment integration arrives in
                  a future phase.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent transactions" />
            <Table
              head={
                <>
                  <Th>Item</Th>
                  <Th className="text-right">Amount</Th>
                </>
              }
            >
              <tr>
                <Td className="text-muted-foreground">No transactions yet</Td>
                <Td className="text-right text-muted-foreground">-</Td>
              </tr>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Credit usage" />
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Each tool run consumes credits based on its plan tier.</p>
              <p>Deep reviews and larger documents cost more credits.</p>
              <p>Free tools never consume credits.</p>
            </CardContent>
          </Card>

          <Link href="/pricing">
            <Button variant="outline" className="w-full">
              Compare plans
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
