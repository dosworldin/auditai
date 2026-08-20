"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, LibraryBig } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { STORY_WORKS } from "@/lib/storyverse/data";
import { WorkCard } from "@/components/storyverse/WorkCard";

export default function StoryVerseLibraryPage() {
  const [showSamples, setShowSamples] = useState(false);

  return (
    <Container className="py-8">
      <PageHeader
        title="StoryVerse Library"
        description="Your reading shelf: purchased works, saved stories and works you contribute to."
        icon={<LibraryBig className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: "Library" },
        ]}
        actions={
          !showSamples ? (
            <Button variant="outline" onClick={() => setShowSamples(true)}>
              Load sample library
            </Button>
          ) : null
        }
      />

      {showSamples ? (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
              <BookMarked className="h-5 w-5 text-muted-foreground" /> Purchased & saved
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STORY_WORKS.slice(0, 3).map((work) => (
                <WorkCard key={work.id} work={work} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground">
              Contributing
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STORY_WORKS.slice(3, 5).map((work) => (
                <div key={work.id} className="relative">
                  <WorkCard work={work} />
                  <div className="mt-2 flex justify-center">
                    <Link href={`/storyverse/write/${work.id}`}>
                      <Button size="sm">
                        Continue writing <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <p className="text-xs text-muted-foreground">
            Sample library rows are illustrative only and are not persisted.
          </p>
        </div>
      ) : (
        <EmptyState
          icon={<LibraryBig className="h-6 w-6" />}
          title="Your library is empty"
          description="Stories you purchase or save will appear here. Browse the marketplace or load sample data to preview the shelf."
          action={
            <div className="flex gap-2">
              <Link href="/storyverse/marketplace">
                <Button size="sm">Browse marketplace</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setShowSamples(true)}>
                Load sample library
              </Button>
            </div>
          }
        />
      )}

      <div className="mt-6">
        <Badge tone="neutral">Co-authors receive automatic free access to works they contributed to</Badge>
      </div>
    </Container>
  );
}
