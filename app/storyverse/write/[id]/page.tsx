"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PenLine,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { RequireAuth } from "@/components/auth/RequireAuth";

interface StoryData {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  coverColor: string;
  contributors: { display_name: string; role: string; country: string | null }[];
}

interface ContributionData {
  id: string;
  content: string;
  authorDisplayName: string;
  wordCount: number;
  votes: number;
  status: string;
}

interface RoundData {
  id: string;
  roundNumber: number;
  status: string;
}

export default function WritePage() {
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryData | null>(null);
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null);
  const [contributions, setContributions] = useState<ContributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [snippet, setSnippet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voteNotice, setVoteNotice] = useState<string | null>(null);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementText, setAgreementText] = useState("");
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const loadStory = useCallback(async () => {
    try {
      const res = await fetch(`/api/storyverse/stories/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setStory(data.story);
        if (data.round) setCurrentRound(data.round);
        if (data.contributions) setContributions(data.contributions);
      }
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  const submitContribution = async () => {
    if (!snippet.trim() || !currentRound) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/storyverse/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: params.id,
          roundId: currentRound.id,
          content: snippet.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.requiresAgreement) {
          // Contributor Agreement required — open the acceptance flow.
          setError("");
          await openAgreement();
          return;
        }
        setError(data.error || "Failed to submit");
        return;
      }

      setSubmitted(true);
      setSnippet("");
      // Reload contributions
      loadStory();
    } catch {
      setError("Failed to submit contribution");
    } finally {
      setSubmitting(false);
    }
  };

  const openAgreement = async () => {
    setShowAgreement(true);
    setAgreementLoading(true);
    try {
      const res = await fetch("/api/storyverse/agreement");
      if (res.ok) {
        const data = await res.json();
        setAgreementText(data.agreementText || "");
        if (data.hasAccepted) {
          setAgreed(true);
        }
      }
    } catch {
      // keep modal open with empty text
    } finally {
      setAgreementLoading(false);
    }
  };

  const acceptAgreement = async () => {
    setAgreementLoading(true);
    try {
      const res = await fetch("/api/storyverse/agreement", { method: "POST" });
      if (res.ok) {
        setAgreed(true);
        setShowAgreement(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to accept agreement");
      }
    } catch {
      setError("Failed to accept agreement");
    } finally {
      setAgreementLoading(false);
    }
  };

  const castVote = async (contributionId: string) => {
    if (!currentRound) return;
    setVotingId(contributionId);

    try {
      const res = await fetch("/api/storyverse/contribute", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributionId,
          storyId: params.id,
          roundId: currentRound.id,
          voteType: "free",
        }),
      });

      if (res.ok) {
        setVotedIds(new Set([...votedIds, contributionId]));
        setVoteNotice(null);
        loadStory();
      } else {
        const data = await res.json().catch(() => null);
        if (data?.requiresContribution) {
          setVoteNotice(
            "Voting on this story is for its contributors — add a snippet in any round to unlock free votes, or use a paid vote from the story page to support the authors.",
          );
        } else if (data?.freeVotesExhausted) {
          setVoteNotice(
            `You've used all ${data.freeVoteLimit ?? 5} of your free contributor votes on this story. You can keep supporting it with paid votes from the story page — they go straight to the author pool.`,
          );
        } else {
          setVoteNotice(data?.error ?? "Vote failed.");
        }
      }
    } catch {
      setVoteNotice("Vote failed — please try again.");
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <Container className="py-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  if (!story) {
    return (
      <Container className="py-8">
        <div className="text-center text-muted-foreground">Story not found</div>
      </Container>
    );
  }

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title={`Write - ${story.title}`}
          description={`Round ${story.currentRound} of ${story.totalRounds}. Contribute a snippet for the community to vote on.`}
          icon={<PenLine className="h-5 w-5" />}
          breadcrumbs={[
            { label: "StoryVerse", href: "/storyverse" },
            { label: story.title, href: `/storyverse/read/${story.id}` },
            { label: "Write" },
          ]}
          actions={
            <Link href={`/storyverse/read/${story.id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> Read view
              </Button>
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Your contribution" subtitle="Write the next snippet for this round" icon={<Vote className="h-4 w-4" />} />
              <CardContent className="space-y-4">
                <Field label="Snippet" help="A sentence or two that extends the canon naturally.">
                  <Textarea
                    rows={5}
                    placeholder="Continue the scene..."
                    value={snippet}
                    onChange={(e) => setSnippet(e.target.value)}
                  />
                </Field>
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button onClick={submitContribution} loading={submitting} disabled={!snippet.trim()}>
                    <ShieldCheck className="h-4 w-4" /> Submit contribution
                  </Button>
                  {submitted && (
                    <span className="inline-flex items-center gap-1 text-sm text-success animate-fade-in">
                      <CheckCircle2 className="h-4 w-4" /> Submitted for community vote
                    </span>
                  )}
                </div>

                {showAgreement && (
                  <div className="rounded-xl border border-info/30 bg-info/5 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-info" />
                      <p className="text-sm font-semibold text-foreground">
                        Contributor Agreement required
                      </p>
                    </div>
                    {agreementLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading agreement...
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                          {agreementText || "Agreement text unavailable. Please refresh."}
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" onClick={acceptAgreement} disabled={agreed || !agreementText}>
                            {agreed ? "Accepted" : "Accept & continue"}
                          </Button>
                          {agreed && (
                            <span className="inline-flex items-center gap-1 text-sm text-success animate-fade-in">
                              <CheckCircle2 className="h-4 w-4" /> Agreement accepted — you can submit now
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {contributions.length > 0 && (
              <Card>
                <CardHeader
                  title="Pending contributions"
                  subtitle="Vote for the next canon snippet"
                  actions={<Badge tone="info">{contributions.length} to vote</Badge>}
                />
                <CardContent className="space-y-4">
                  {voteNotice ? (
                    <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
                      {voteNotice}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Vote rule: contributors get 5 free votes per story (admin-adjustable); once they're used up, paid votes support the authors. Readers who never contributed can also vote with paid votes.
                  </p>
                  {contributions.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{c.authorDisplayName}</p>
                            <Badge tone={c.status === "CANON" ? "success" : c.status === "FLAGGED" ? "destructive" : "neutral"}>
                              {c.status}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{c.content}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              variant={votedIds.has(c.id) ? "success" : "outline"}
                              size="sm"
                              onClick={() => castVote(c.id)}
                              disabled={votingId === c.id || votedIds.has(c.id)}
                            >
                              {votingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />} {c.votes}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {votedIds.has(c.id) ? "Vote recorded" : "Vote to help canon"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Round status" />
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Chapter</span>
                  <span className="font-medium text-foreground">{story.currentRound} of {story.totalRounds}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contributors</span>
                  <span className="font-medium text-foreground">{story.contributors?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Votes cast</span>
                  <span className="font-medium text-foreground">{contributions.reduce((sum, c) => sum + c.votes, 0)}</span>
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
                <p>3. If AI suggests a rewrite, author must approve before canonization.</p>
                <p>4. Copyright similarity is NOT a legal determination.</p>
                <p>5. Solo invitations may charge a fee (admin-configurable).</p>
                <p>6. Pool stories enter inactivity hold after configured days with a single contributor.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </RequireAuth>
  );
}
