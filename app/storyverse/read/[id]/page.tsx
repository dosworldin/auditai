"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  PenLine,
  Users,
} from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { STORY_WORKS } from "@/lib/storyverse/data";
import { cn } from "@/lib/utils";

const CHAPTERS = [
  { id: "ch1", title: "The Second Bell", author: "Maya R., Kiran V." },
  { id: "ch2", title: "The Journal", author: "Maya R., Priya L." },
  { id: "ch3", title: "Tomorrow", author: "Kiran V., 2 more" },
  { id: "ch4", title: "The Keeper", author: "Community canon" },
];

const SAMPLE_PARAGRAPHS = [
  "The storm bell rang twice, then fell silent. In the village below, every window went dark at once - a signal older than the town itself.",
  "At the top of the spiral stairs, the keeper turned the journal's final page. The ink there was fresher than any page before it, and it had not been written by him.",
  "Three words waited at the bottom of the page: You know why.",
];

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const work = STORY_WORKS.find((w) => w.id === params.id) ?? STORY_WORKS[0];
  const [chapter, setChapter] = useState(CHAPTERS[0]);
  const [saved, setSaved] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title={work.title}
        description={work.synopsis}
        icon={<BookOpen className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: work.genre, href: "/storyverse/marketplace" },
          { label: work.title },
        ]}
        actions={
          <>
            <Link href={`/storyverse/write/${work.id}`}>
              <Button variant="outline" size="sm">
                <PenLine className="h-4 w-4" /> Contribute
              </Button>
            </Link>
            <Link href="/storyverse/marketplace">
              <Button size="sm">Get on Marketplace</Button>
            </Link>
          </>
        }
      />

      <div className="mb-6">
        <BlueprintNote>
          Reader view is a blueprint. Reading progress, purchases, and access
          controls are implemented in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {chapter.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Contributed by {chapter.author}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaved(!saved)}
                  >
                    <Bookmark
                      className={cn("h-4 w-4", saved && "fill-primary text-primary")}
                    />
                    {saved ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {SAMPLE_PARAGRAPHS.map((paragraph, i) => (
                  <p key={i} className="leading-8 text-foreground">
                    {paragraph}
                  </p>
                ))}
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Blueprint sample text - full chapters will be rendered from
                  canon in a future phase.
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                <Button variant="outline" size="sm">Previous chapter</Button>
                <Button size="sm">Next chapter</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge tone="primary">{work.genre}</Badge>
                <Badge
                  tone={
                    work.status === "Published"
                      ? "success"
                      : work.status === "In Review"
                        ? "warning"
                        : "info"
                  }
                >
                  {work.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                By {work.author} and the community
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4" /> {work.contributors} contributors
                </span>
                <span>{work.chapters} chapters</span>
              </div>
              <Button variant="secondary" className="w-full" onClick={() => setSaved(true)}>
                <Bookmark className="h-4 w-4" /> Add to library
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">
                Chapters
              </p>
              <ol className="space-y-1">
                {CHAPTERS.map((ch) => (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => setChapter(ch)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        chapter.id === ch.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {ch.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {ch.author}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
