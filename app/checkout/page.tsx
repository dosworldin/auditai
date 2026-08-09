"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { BlueprintNote } from "@/components/layout/Container";

export default function CheckoutPage() {
  const [plan, setPlan] = useState("pro");
  const [billing, setBilling] = useState("monthly");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const plans: Record<string, { label: string; price: number }> = {
    starter: { label: "Starter", price: 4.99 },
    pro: { label: "Pro", price: 9.99 },
    business: { label: "Business", price: 19.99 },
  };

  const monthly = plans[plan]?.price ?? 9.99;
  const total = billing === "yearly" ? Math.round(monthly * 0.8 * 100) / 100 : monthly;

  return (
    <Container className="py-8">
      <PageHeader
        title="Checkout"
        description="Review your plan and continue to payment."
        icon={<CreditCard className="h-5 w-5" />}
        breadcrumbs={[{ label: "Pricing", href: "/pricing" }, { label: "Checkout" }]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Blueprint only: no payment is processed and no real data is collected
          here. Billing, payments and payouts are implemented in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Plan selection" />
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Plan">
                  <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
                    <option value="starter">Starter - $4.99/mo</option>
                    <option value="pro">Pro - $9.99/mo</option>
                    <option value="business">Business - $19.99/mo</option>
                  </Select>
                </Field>
                <Field label="Billing cycle">
                  <Select value={billing} onChange={(e) => setBilling(e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly (save 20%)</option>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Payment details"
              subtitle="Simulated - no payment is actually processed"
            />
            <CardContent className="space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cardholder name">
                  <Input placeholder="Full name" />
                </Field>
                <Field label="Card number">
                  <Input placeholder="4242 4242 4242 4242" inputMode="numeric" />
                </Field>
                <Field label="Expiry">
                  <Input placeholder="MM / YY" />
                </Field>
                <Field label="Security code">
                  <Input placeholder="CVC" inputMode="numeric" />
                </Field>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Your payment details are never stored in the blueprint phase.
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full"
            onClick={() => setSubmitted(true)}
            disabled={email.trim().length === 0}
          >
            <ShieldCheck className="h-4 w-4" /> Pay ${total.toFixed(2)} / month
          </Button>

          {submitted ? (
            <div
              className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-foreground animate-fade-in"
              role="status"
            >
              Blueprint: your order was simulated, not processed. Payment
              integration arrives in a future phase.
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Order summary" />
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium text-foreground">
                  {plans[plan]?.label ?? "Pro"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Billing</span>
                <span className="font-medium capitalize text-foreground">{billing}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-medium text-foreground">
                  {plan === "starter" ? 100 : plan === "business" ? 1000 : 400}/mo
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">
                  ${total.toFixed(2)}
                </span>
              </div>
              <Badge tone="neutral" className="w-full justify-center">
                Tax calculated in a future phase
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">You'll get</p>
              <p>Instant activation on payment success</p>
              <p>Credits usable across tools and Labs</p>
              <p>Monthly rollover up to your plan cap</p>
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
  );
}
