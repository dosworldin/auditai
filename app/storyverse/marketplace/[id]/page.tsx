"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookOpen, CreditCard } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { STORY_WORKS } from "@/lib/storyverse/data";
import { accent } from "@/components/ui/Accent";
import { cn } from "@/lib/utils";

export default function StoryVerseMarketplaceDetailPage() {
  const params = useParams<{ id: string }>();
  const work = STORY_WORKS.find((w) => w.id === params.id) ?? STORY_WORKS[3];
  const a = accent(work.coverColor);
  const [purchased, setPurchased] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title={work.title}
        description={work.synopsis}
        icon={<BookOpen className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: "Marketplace", href: "/storyverse/marketplace" },
          { label: work.title },
        ]}
      />

      <div className="mb-6">
        <BlueprintNote>
          Purchase and licensing are simulated. Marketplace commerce is
          implemented in a future phase.
        </BlueprintNote>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent>
              <div className={cn("flex h-32 items-end rounded-xl bg-gradient-to-br p-5", a.solid)}>
                <div className="text-white">
                  <p className="text-xs uppercase tracking-wider opacity-80">
                    {work.genre} - {work.status}
                  </p>
                  <h2 className="text-2xl font-bold">{work.title}</h2>
                </div>
              </div>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                A community-written {work.genre.toLowerCase()} built across{" "}
                {work.contributors} contributors and {work.chapters} chapters.
                Every chapter passed AI continuity and safety checks before
                reaching canon, and the full work passed publication review.
              </p>
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Full excerpt text is a blueprint placeholder and will be
                rendered from the published canon in a future phase.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Publication details" />
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <span className="text-muted-foreground">Primary author</span>
                <span className="font-medium text-foreground">{work.author}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <span className="text-muted-foreground">Contributors</span>
                <span className="font-medium text-foreground">{work.contributors}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <span className="text-muted-foreground">Chapters</span>
                <span className="font-medium text-foreground">{work.chapters}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <span className="text-muted-foreground">Reader rating</span>
                <span className="font-medium text-foreground">4.8 / 5</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="text-3xl font-extrabold text-foreground">$4.99</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Revenue is shared with the primary author and canon
                contributors per the platform's rules (future phase).
              </p>
              {purchased ? (
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-foreground animate-fade-in">
                    Purchase simulated! Add it to your library to read.
                  </div>
                  <Link href={`/storyverse/library`}>
                    <Button className="w-full">
                      <Bookmark className="h-4 w-4" /> Go to library
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <Button className="w-full" onClick={() => setPurchased(true)}>
                    <CreditCard className="h-4 w-4" /> Purchase for $4.99
                  </Button>
                  <Link href={`/storyverse/read/${work.id}`}>
                    <Button variant="outline" className="w-full">
                      Read preview
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Link href="/storyverse/marketplace">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="h-4 w-4" /> Back to marketplace
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
