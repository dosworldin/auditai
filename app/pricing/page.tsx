"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Plan {
  name: string;
  price: number;
  period: "month" | "year";
  tagline: string;
  featured?: boolean;
  features: string[];
  credits: string;
}

const monthlyPlans: Plan[] = [
  {
    name: "Free",
    price: 0,
    period: "month",
    tagline: "For everyday personal audits",
    credits: "10 credits / month",
    features: [
      "Access to free audit tools",
      "5 saved reports",
      "1 StoryVerse story",
      "Community support",
    ],
  },
  {
    name: "Starter",
    price: 4.99,
    period: "month",
    tagline: "For individuals who audit often",
    credits: "100 credits / month",
    features: [
      "All free tools",
      "Starter-tier paid tools",
      "Unlimited saved reports",
      "3 StoryVerse stories",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: 9.99,
    period: "month",
    tagline: "For power users and professionals",
    credits: "400 credits / month",
    featured: true,
    features: [
      "Everything in Starter",
      "All Pro-tier tools",
      "Priority processing",
      "PDF report export",
      "10 StoryVerse stories",
    ],
  },
  {
    name: "Business",
    price: 19.99,
    period: "month",
    tagline: "For teams and small businesses",
    credits: "1,000 credits / month",
    features: [
      "Everything in Pro",
      "Business-tier tools",
      "Team seats (5)",
      "Shared report library",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Pricing"
        description="Simple plans with credits you can spend across audit tools, Labs and StoryVerse."
        icon={<CreditCard className="h-5 w-5" />}
      />

      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={cn("text-sm", !yearly ? "font-semibold text-foreground" : "text-muted-foreground")}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly(!yearly)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            yearly ? "bg-primary" : "bg-input",
          )}
          aria-label="Toggle yearly billing"
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              yearly ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
        <span className={cn("text-sm", yearly ? "font-semibold text-foreground" : "text-muted-foreground")}>
          Yearly <Badge tone="success" className="ml-1">Save 20%</Badge>
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {monthlyPlans.map((plan) => {
          const price = yearly ? Math.round(plan.price * 0.8 * 100) / 100 : plan.price;
          return (
            <Card
              key={plan.name}
              className={cn(
                "relative flex flex-col",
                plan.featured && "border-primary shadow-lg",
              )}
            >
              {plan.featured ? (
                <Badge tone="primary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Sparkles className="h-3 w-3" /> Most popular
                </Badge>
              ) : null}
              <div className="flex h-full flex-col p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">
                    ${price.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {plan.period}
                  </span>
                </div>
                <p className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  {plan.credits}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/checkout" className="mt-6">
                  <Button
                    className="w-full"
                    variant={plan.featured ? "primary" : "outline"}
                  >
                    {plan.price === 0 ? "Get started free" : "Choose plan"}
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
        <h3 className="text-lg font-semibold text-foreground">
          Need something bigger?
        </h3>
        <p className="max-w-xl text-sm text-muted-foreground">
          Enterprise plans include custom credit pools, dedicated processing,
          SLA-backed uptime, SSO, and custom tool configurations.
        </p>
        <Link href="/support">
          <Button variant="outline">Contact sales</Button>
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Pricing is a blueprint placeholder. Billing and payment infrastructure
        is intentionally not implemented in this phase.
      </p>
    </Container>
  );
}
