"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, LibraryBig, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { RequireAuth } from "@/components/auth/RequireAuth";

interface LibraryStory {
  id: string;
  title: string;
  genre: string;
  description: string;
  coverColor: string;
  status: string;
  accessType: string;
}

export default function StoryVerseLibraryPage() {
  const [stories, setStories] = useState<LibraryStory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/storyverse/stories?library=true");
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories ?? []);
      }
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  return (
    <RequireAuth>
      <Container className="py-8">
        <PageHeader
          title="StoryVerse Library"
          description="Your reading shelf: purchased works, saved stories and works you contribute to."
          icon={<LibraryBig className="h-5 w-5" />}
          breadcrumbs={[
            { label: "StoryVerse", href: "/storyverse" },
            { label: "Library" },
          ]}
        />

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stories.length > 0 ? (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                <BookMarked className="h-5 w-5 text-muted-foreground" /> Your stories
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stories.map((story) => (
                  <div key={story.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-foreground">{story.title}</h3>
                      <Badge tone={story.status === "MARKETPLACE" ? "success" : story.status === "ACTIVE" ? "info" : "neutral"}>
                        {story.accessType === "co_author" ? "Contributing" : story.accessType === "purchased" ? "Purchased" : "In Library"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{story.genre}</p>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{story.description}</p>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/storyverse/read/${story.id}`}>
                        <Button size="sm" variant="outline">Read</Button>
                      </Link>
                      <Link href={`/storyverse/write/${story.id}`}>
                        <Button size="sm">
                          Continue writing <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <EmptyState
            icon={<LibraryBig className="h-6 w-6" />}
            title="Your library is empty"
            description="Stories you purchase or save will appear here. Browse the marketplace to get started."
            action={
              <Link href="/storyverse/marketplace">
                <Button size="sm">Browse marketplace</Button>
              </Link>
            }
          />
        )}

        <div className="mt-6">
          <Badge tone="neutral">Co-authors receive automatic free access to works they contributed to</Badge>
        </div>
      </Container>
    </RequireAuth>
  );
}
