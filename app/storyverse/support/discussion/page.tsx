"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquareText, Pin } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/PageHeader";
import { DISCUSSION_THREADS } from "@/lib/storyverse/data";

export default function StoryVerseDiscussionPage() {
  const [openThread, setOpenThread] = useState<string | null>(DISCUSSION_THREADS[0].id);
  const [posted, setPosted] = useState(false);

  const active = DISCUSSION_THREADS.find((t) => t.id === openThread);

  return (
    <Container className="py-8">
      <PageHeader
        title="Community Discussions"
        description="Coordinate canon, debate plot twists, and shape the future of your stories."
        icon={<MessageSquareText className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: "Discussions" },
        ]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Discussion threads are blueprint placeholders. Real-time messaging
          and notifications land in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          {DISCUSSION_THREADS.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setOpenThread(thread.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                openThread === thread.id
                  ? "border-primary bg-accent/40"
                  : "border-border bg-card hover:bg-secondary/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {thread.title}
                </p>
                {thread.pinned ? (
                  <Pin className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {thread.author} - {thread.replies} replies - {thread.lastActivity}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <Avatar name="Maya R." />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Maya R.</p>
                    <Badge tone="primary">Author</Badge>
                  </div>
                  <h2 className="mt-1 font-semibold text-foreground">
                    {active?.title ?? "Discussion"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    I wanted to open the floor on this one. Several of you have
                    raised it in earlier rounds and I think it deserves a
                    community decision before we close the chapter.
                  </p>
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Blueprint placeholder message - full threading is not
                    implemented yet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <Field label="Reply to discussion">
                <Textarea rows={3} placeholder="Share your thoughts..." />
              </Field>
              <div className="flex items-center gap-3">
                <Button onClick={() => setPosted(true)} disabled={posted}>
                  Post reply
                </Button>
                {posted ? (
                  <span className="text-sm text-success animate-fade-in">
                    Reply simulated - not persisted in blueprint.
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href="/storyverse">
              <Button variant="outline">Back to StoryVerse</Button>
            </Link>
            <Link href="/storyverse/create">
              <Button variant="outline">Start a new story</Button>
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
