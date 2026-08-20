"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookOpen, CreditCard, Loader2, Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface StoryData {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: string;
  coverColor: string;
  storyType: string;
  contributors: { display_name: string; role: string }[];
  tags: string[];
}

export default function StoryVerseMarketplaceDetailPage() {
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);

  const loadStory = useCallback(async () => {
    try {
      const res = await fetch(`/api/storyverse/stories/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setStory(data.story);
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
    <Container className="py-8">
      <PageHeader
        title={story.title}
        description={story.description}
        icon={<BookOpen className="h-5 w-5" />}
        breadcrumbs={[
          { label: "StoryVerse", href: "/storyverse" },
          { label: "Marketplace", href: "/storyverse/marketplace" },
          { label: story.title },
        ]}
        actions={
          <Link href="/storyverse/marketplace">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Badge tone="primary">{story.genre}</Badge>
                <Badge tone={story.status === "PUBLISHED" || story.status === "MARKETPLACE" ? "success" : "info"}>
                  {story.status}
                </Badge>
                <Badge tone="neutral">{story.storyType}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{story.description}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {(story.tags ?? []).map((tag) => (
                  <Badge key={tag} tone="neutral">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Publication</p>
              <p>Revenue model: 30% platform / 70% author pool (book sales).</p>
              <p>Paid voting: 70% platform / 30% author pool.</p>
              <p>Author shares are frozen at publication via immutable snapshots.</p>
              <p>Purchase processing is simulated — real payment integration coming soon.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                onClick={() => setPurchased(true)}
                disabled={purchased}
              >
                {purchased ? "Added to Library" : <><CreditCard className="h-4 w-4" /> Get this story</>}
              </Button>
              <Link href={`/storyverse/write/${story.id}`} className="block">
                <Button variant="outline" className="w-full">Contribute</Button>
              </Link>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {story.contributors?.length ?? 0} contributor(s)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Contributors</p>
              {(story.contributors ?? []).map((c) => (
                <div key={c.display_name} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-muted-foreground">{c.display_name}</span>
                  <Badge tone={c.role === "owner" ? "primary" : "neutral"}>{c.role}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
