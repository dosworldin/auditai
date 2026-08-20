"use client";

import { useState, useEffect } from "react";
import { ChevronDown, LifeBuoy, Loader2, MessageCircle, Send } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";

const faqs = [
  {
    q: "Is this a real audit with legal weight?",
    a: "No. Audit results are informational and educational. They are not legal, financial, medical, or tax advice.",
  },
  {
    q: "How do credits work?",
    a: "Each audit run consumes a number of credits based on the tool and its depth. Free tools may have promotional free uses configured by the admin.",
  },
  {
    q: "Does StoryVerse have real payments?",
    a: "StoryVerse has a built-in revenue model with 30/70 book sale splits and 70/30 paid voting splits. Payment processing is simulated; real payment integration is coming soon.",
  },
];

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function SupportPage() {
  const { user, profile } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [topic, setTopic] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Load user's tickets
  useEffect(() => {
    if (!user) return;
    setLoadingTickets(true);
    fetch("/api/support/tickets?limit=10")
      .then((res) => res.json())
      .then((data) => setMyTickets(data.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }, [user]);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: topic, subject, message, priority: "normal" }),
      });

      if (res.ok) {
        setSubmitted(true);
        setSubject("");
        setMessage("");
        // Reload tickets
        const data = await res.json();
        setMyTickets((prev) => [data.ticket, ...prev]);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit ticket");
      }
    } catch {
      setError("Failed to submit ticket. Make sure you are signed in.");
    } finally {
      setSubmitting(false);
    }
  };

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

          {/* My Tickets */}
          {user && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Your tickets</h3>
              {loadingTickets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : myTickets.length > 0 ? (
                <div className="space-y-2">
                  {myTickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge tone={ticket.status === "open" ? "info" : ticket.status === "resolved" ? "success" : "warning"}>
                        {ticket.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tickets yet.</p>
              )}
            </div>
          )}
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
            <Field label="Subject">
              <Input
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
            <Field label="Message">
              <Textarea
                rows={5}
                placeholder="How can we help?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !subject.trim() || !message.trim()}
              className="w-full"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send message</>}
            </Button>

            {submitted && (
              <div
                className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-foreground animate-fade-in"
                role="status"
              >
                Your support ticket has been submitted. We&apos;ll get back to you soon.
              </div>
            )}

            {!user && (
              <p className="text-xs text-muted-foreground text-center">
                Sign in to submit a support ticket.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
