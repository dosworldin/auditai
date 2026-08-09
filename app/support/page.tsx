"use client";

import { useState } from "react";
import { ChevronDown, LifeBuoy, MessageCircle, Send } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is this a real audit with legal weight?",
    a: "No. Audit results are informational and educational. They are not legal, financial, medical, or tax advice. Blueprint phase reports contain no analysis at all yet.",
  },
  {
    q: "How do credits work?",
    a: "Each audit run consumes a number of credits based on the tool and its depth. Credits are a placeholder concept until billing is implemented in a future phase.",
  },
  {
    q: "When will the analysis engines be available?",
    a: "Blueprint Phase 1 ships the full frontend and module architecture. Business logic, AI prompts and scoring are intentionally deferred to later phases.",
  },
  {
    q: "Does StoryVerse have real payments?",
    a: "No. Attribution, revenue shares and payouts are defined as concepts only. Payments, billing and payouts are future-phase work.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [topic, setTopic] = useState("general");
  const [submitted, setSubmitted] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="Support"
        description="Answers to common questions and a way to reach the team."
        icon={<LifeBuoy className="h-5 w-5" />}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={faq.q} className="overflow-hidden rounded-xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    aria-expanded={open}
                  >
                    {faq.q}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  {open ? (
                    <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground animate-fade-in">
                      {faq.a}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline">
              <MessageCircle className="h-4 w-4" /> Community discussions
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Contact us"
            subtitle="We typically reply within one business day"
            icon={<Send className="h-4 w-4" />}
          />
          <CardContent className="space-y-4">
            <Field label="Topic">
              <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="general">General question</option>
                <option value="billing">Billing</option>
                <option value="tools">Audit tools</option>
                <option value="storyverse">StoryVerse</option>
                <option value="labs">Labs</option>
              </Select>
            </Field>
            <Field label="Email">
              <Input type="email" placeholder="you@example.com" />
            </Field>
            <Field label="Message">
              <Textarea rows={5} placeholder="How can we help?" />
            </Field>
            <Button
              onClick={() => setSubmitted(true)}
              disabled={submitted}
              className="w-full"
            >
              Send message
            </Button>
            {submitted ? (
              <div
                className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-foreground animate-fade-in"
                role="status"
              >
                Blueprint: your message was not actually sent. Support delivery
                is implemented in a future phase.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
