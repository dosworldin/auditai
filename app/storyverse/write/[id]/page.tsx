"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  PenLine,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/PageHeader";
import { Field, Textarea } from "@/components/ui/Field";
import { SNIPPETS, STORY_WORKS } from "@/lib/storyverse/data"

export default function WritePage() {
  const params = useParams<{ id: string }>();
  const work = STORY_WORKS.find((w) => w.id === params.id) ?? STORY_WORKS[0];
  const [snippet, setSnippet] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 1200));
    setChecking(false);
    setSubmitted(true);
    setSnippet("");
  };

  return (
    <Container className="py-8">
      <PageHeader
        title={`Write - ${work.title}`}
        description={`Round ${work.rounds} of chapter ${work.chapters}. Contribute a snippet for the community to vote on.`}
        icon={<PenLine className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: work.title, href: `/storyverse/read/${work.id}` },
          { label: "Write" },
        ]}
        actions={
          <Link href={`/storyverse/read/${work.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Read view
            </Button>
          </Link>
        }
      />

      <div className="mb-6">
        <BlueprintNote>
          StoryVerse business logic v2: contributor agreement required before
          first contribution. AI Editor runs post-voting with continuity and
          copyright checks. Pricing shown below is from admin config.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Current canon"
              subtitle="Established content in this chapter"
            />
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The storm bell rang twice, then fell silent. The keeper stood at
                the top of the spiral stairs, the open journal heavy in his
                hands. Every prediction it had made so far had come true - and
                the last line mentioned tomorrow.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="success">Canon - Round 7</Badge>
                <Badge tone="neutral">By Maya R. and 3 others</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Your contribution"
              subtitle="Write the next snippet for this round"
              icon={<Vote className="h-4 w-4" />}
            />
            <CardContent className="space-y-4">
              <Field label="Snippet" help="A sentence or two that extends the canon naturally.">
                <Textarea
                  rows={5}
                  placeholder="Continue the scene..."
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value)}
                />
              </Field>
              <div className="flex items-center gap-3">
                <Button
                  onClick={submit}
                  loading={checking}
                  disabled={snippet.trim().length === 0}
                >
                  <ShieldCheck className="h-4 w-4" /> Run AI check & submit
                </Button>
                {submitted ? (
                  <span className="inline-flex items-center gap-1 text-sm text-success animate-fade-in">
                    <CheckCircle2 className="h-4 w-4" /> Submitted for community vote (simulated)
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Pending contributions"
              subtitle="Vote for the next canon snippet"
              actions={<Badge tone="info">{SNIPPETS.length} to vote</Badge>}
            />
            <CardContent className="space-y-4">
              {SNIPPETS.map((snip) => (
                <SnippetRow key={snip.id} snip={snip} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Round status" />
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chapter</span>
                <span className="font-medium text-foreground">
                  {work.chapters} of 12
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Round</span>
                <span className="font-medium text-foreground">{work.rounds}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contributors</span>
                <span className="font-medium text-foreground">
                  {work.contributors}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Votes cast</span>
                <span className="font-medium text-foreground">128</span>
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Winning contributions become canon when the round closes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Business logic" />
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Contributors must accept the Contributor Agreement before first contribution.</p>
              <p>2. After voting, AI Editor runs continuity + copyright checks.</p>
              <p>3. AI Editor cost: 10 credits per execution.</p>
              <p>4. If AI suggests a rewrite, author must approve before canonization.</p>
              <p>5. Copyright similarity is NOT a legal determination.</p>
              <p>6. Solo invitations may charge a fee (admin-configurable).</p>
              <p>7. Pool stories enter inactivity hold after 7 days with a single contributor.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}

function SnippetRow({ snip }: { snip: (typeof SNIPPETS)[number] }) {
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <Avatar name={snip.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{snip.author}</p>
            <Badge
              tone={
                snip.aiStatus === "Passed"
                  ? "success"
                  : snip.aiStatus === "Flagged"
                    ? "destructive"
                    : "warning"
              }
            >
              AI: {snip.aiStatus}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            {snip.text}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant={voted === "up" ? "success" : "outline"}
              size="sm"
              onClick={() => setVoted(voted === "up" ? null : "up")}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> {snip.votes}
            </Button>
            <Button
              variant={voted === "down" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setVoted(voted === "down" ? null : "down")}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {voted ? "Your vote recorded (simulated)" : "Vote to help canon"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
