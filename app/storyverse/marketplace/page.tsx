"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";
import { Container, BlueprintNote } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { STORY_WORKS } from "@/lib/storyverse/data";
import { accent } from "@/components/ui/Accent";
import { cn } from "@/lib/utils";

const marketEntries = [
  {
    work: STORY_WORKS[3],
    price: "$4.99",
    purchases: 1240,
    rating: "4.8",
  },
  {
    work: STORY_WORKS[1],
    price: "$3.49",
    purchases: 862,
    rating: "4.6",
  },
  {
    work: STORY_WORKS[0],
    price: "$2.99",
    purchases: 0,
    rating: "New",
  },
];

export default function StoryVerseMarketplacePage() {
  const [filter, setFilter] = useState("All");

  return (
    <Container className="py-8">
      <PageHeader
        title="StoryVerse Marketplace"
        description="Published works from the community, available to readers and licensed through the platform."
        icon={<Store className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: "Marketplace" },
        ]}
      />

      <div className="mb-6">
        <BlueprintNote>
          StoryVerse marketplace engine is live: book sales follow 30/70 split (Platform/Authors).
          Published works have immutable publication snapshots with frozen author shares.
          Co-authors receive free access to works they contributed to.
        </BlueprintNote>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["All", "Free", "Paid", "Featured"].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilter(label)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === label
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {marketEntries.map((entry) => {
          const a = accent(entry.work.coverColor);
          return (
            <Link key={entry.work.id} href={`/storyverse/marketplace/${entry.work.id}`}>
              <Card interactive className="h-full">
                <div className="flex h-full flex-col">
                  <div className={cn("flex h-28 items-end rounded-t-xl bg-gradient-to-br p-4", a.solid)}>
                    <div className="text-white">
                      <p className="text-xs uppercase tracking-wider opacity-80">
                        {entry.work.genre}
                      </p>
                      <h3 className="text-lg font-bold">{entry.work.title}</h3>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="flex-1 text-sm text-muted-foreground">
                      {entry.work.synopsis}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">
                        {entry.price}
                      </span>
                      <Badge tone="neutral">
                        {entry.rating} - {entry.purchases} readers
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge tone="success">Published</Badge>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        View <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Want your story here?</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Complete your story, pass publication review, and the community
          votes to publish it in the Marketplace.
        </p>
        <Link href="/storyverse/create">
          <Button variant="outline">Create a story</Button>
        </Link>
      </div>
    </Container>
  );
}
