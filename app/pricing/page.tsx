"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, Sparkles, Loader2 } from "lucide-react";
import { TOOL_COUNT } from "@/lib/tools/registry";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CreditPack {
  label: string;
  credits: number;
  price: number;
  tagline?: string;
  featured?: boolean;
}

const FALLBACK_PACKS: CreditPack[] = [
  { label: "Starter Pack", credits: 100, price: 4.99, tagline: "For occasional audits" },
  { label: "Pro Pack", credits: 400, price: 14.99, tagline: "For regular users", featured: true },
  { label: "Business Pack", credits: 1000, price: 29.99, tagline: "For teams and heavy use" },
];

export default function PricingPage() {
  const [packs, setPacks] = useState<CreditPack[]>(FALLBACK_PACKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing/credit-packs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.packs?.length) setPacks(data.packs);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Container className="py-8">
      <PageHeader
        title="Pricing"
        description="Prepaid credit packs usable across all audit tools, Labs and StoryVerse. No subscriptions — pay for what you use."
        icon={<CreditCard className="h-5 w-5" />}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {packs.map((pack) => {
            const perCredit = pack.credits > 0 ? pack.price / pack.credits : 0;
            return (
              <Card
                key={pack.label}
                className={cn(
                  "relative flex flex-col",
                  pack.featured && "border-primary shadow-lg",
                )}
              >
                {pack.featured ? (
                  <Badge tone="primary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </Badge>
                ) : null}
                <div className="flex h-full flex-col p-6">
                  <h3 className="text-lg font-semibold text-foreground">{pack.label}</h3>
                  {pack.tagline ? (
                    <p className="mt-1 text-sm text-muted-foreground">{pack.tagline}</p>
                  ) : null}
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-foreground">
                      ${pack.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    {pack.credits.toLocaleString()} credits
                    {perCredit > 0 ? ` · $${perCredit.toFixed(3)} per credit` : ""}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">All {TOOL_COUNT} audit tools</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">All Labs experiments</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">StoryVerse features (AI Editor, paid voting)</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">Credits never expire</span>
                    </li>
                  </ul>
                  <Link
                    href={`/checkout?pack=${encodeURIComponent(pack.label)}`}
                    className="mt-6"
                  >
                    <Button className="w-full" variant={pack.featured ? "primary" : "outline"}>
                      Buy credits
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
        <h3 className="text-lg font-semibold text-foreground">
          How credits work
        </h3>
        <p className="max-w-xl text-sm text-muted-foreground">
          Each tool run costs a small number of credits (1–10 depending on the tool).
          New accounts start with free signup credits, and promotions occasionally grant
          free tool uses. Check the Wallet page for your balance and full transaction history.
        </p>
        <Link href="/wallet">
          <Button variant="outline">Open wallet</Button>
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Pack prices are configured by the platform and can change. Payments are processed
        securely through the available gateways at checkout.
      </p>
    </Container>
  );
}
