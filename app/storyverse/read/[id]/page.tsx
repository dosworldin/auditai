"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookOpen, Loader2, PenLine, Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface StoryDetail {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: string;
  storyType: string;
  coverColor: string;
  currentRound: number;
  totalRounds: number;
  contributors: { display_name: string; role: string; country: string | null }[];
  origin_country: string | null;
  tags: string[];
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  word_count: number;
  content?: string;
}

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [chapterContent, setChapterContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadStory = useCallback(async () => {
    try {
      const res = await fetch(`/api/storyverse/stories/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setStory(data.story);
        setChapters(data.chapters ?? []);
      }
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  // Load chapter content when chapter changes
  useEffect(() => {
    if (!chapters[activeChapterIdx]) return;
    const ch = chapters[activeChapterIdx];
    if (ch.content) {
      setChapterContent(ch.content);
      return;
    }
    setLoadingContent(true);
    fetch(`/api/storyverse/stories/${params.id}/chapters/${ch.id}`)
      .then((r) => r.json())
      .then((d) => setChapterContent(d.content ?? ""))
      .catch(() => setChapterContent(""))
      .finally(() => setLoadingContent(false));
  }, [activeChapterIdx, chapters, params.id]);

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

  const activeChapter = chapters[activeChapterIdx];
  const owner = story.contributors?.find((c) => c.role === "owner");

  return (
    <Container className="py-8">
      <PageHeader
        title={story.title}
        description={story.description}
        icon={<BookOpen className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: story.genre, href: "/storyverse/marketplace" },
          { label: story.title },
        ]}
        actions={
          <>
            <Link href={`/storyverse/write/${story.id}`}>
              <Button variant="outline" size="sm">
                <PenLine className="h-4 w-4" /> Contribute
              </Button>
            </Link>
            <Link href="/storyverse/marketplace">
              <Button size="sm">Marketplace</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6 sm:p-8">
              {activeChapter ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {activeChapter.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Chapter {activeChapter.number} · {activeChapter.word_count.toLocaleString()} words
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSaved(!saved)}>
                      <Bookmark className={cn("h-4 w-4", saved && "fill-primary text-primary")} />
                      {saved ? "Saved" : "Save"}
                    </Button>
                  </div>
                  <div className="mt-6 space-y-4">
                    {loadingContent ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading chapter content...
                      </div>
                    ) : chapterContent ? (
                      chapterContent.split("\n").filter(Boolean).map((para, i) => (
                        <p key={i} className="leading-8 text-foreground">{para}</p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        This chapter has no published content yet. Be the first to contribute!
                      </p>
                    )}
                  </div>
                  <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activeChapterIdx === 0}
                      onClick={() => setActiveChapterIdx((i) => Math.max(0, i - 1))}
                    >
                      Previous chapter
                    </Button>
                    <Button
                      size="sm"
                      disabled={activeChapterIdx >= chapters.length - 1}
                      onClick={() => setActiveChapterIdx((i) => Math.min(chapters.length - 1, i + 1))}
                    >
                      Next chapter
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-4 h-10 w-10 opacity-50" />
                  <p className="text-sm">No chapters yet. Start writing to build the story!</p>
                  <Link href={`/storyverse/write/${story.id}`} className="mt-4 inline-block">
                    <Button size="sm">Write the first chapter</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge tone="primary">{story.genre}</Badge>
                <Badge
                  tone={
                    story.status === "PUBLISHED" || story.status === "MARKETPLACE"
                      ? "success"
                      : story.status === "PUBLICATION_REVIEW"
                        ? "warning"
                        : "info"
                  }
                >
                  {story.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                By {owner?.display_name ?? "Unknown"} and {story.contributors?.length ?? 0} contributor(s)
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4" /> {story.contributors?.length ?? 0}
                </span>
                <span>{chapters.length} chapters</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(story.tags ?? []).map((tag) => (
                  <Badge key={tag} tone="neutral">{tag}</Badge>
                ))}
              </div>
              <Button variant="secondary" className="w-full" onClick={() => setSaved(true)}>
                <Bookmark className="h-4 w-4" /> Add to library
              </Button>
            </CardContent>
          </Card>

          {chapters.length > 0 && (
            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-semibold text-foreground">Chapters</p>
                <ol className="space-y-1">
                  {chapters.map((ch, idx) => (
                    <li key={ch.id}>
                      <button
                        type="button"
                        onClick={() => setActiveChapterIdx(idx)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          idx === activeChapterIdx
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        <span className="font-medium text-foreground">{ch.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {ch.word_count.toLocaleString()} words
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {story.storyType === "pool_open" || story.storyType === "pool_private" ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Contributors</p>
                {(story.contributors ?? []).map((c) => (
                  <div key={c.display_name} className="flex items-center justify-between py-1">
                    <span>{c.display_name} {c.country ? `(${c.country})` : ""}</span>
                    <Badge tone={c.role === "owner" ? "primary" : "neutral"}>{c.role}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
