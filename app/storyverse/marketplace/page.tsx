"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Store } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getSupabaseBrowser } from "@/lib/db/supabase-browser";

interface Story {
  id: string;
  title: string;
  description: string;
  genre: string;
  cover_color: string;
  status: string;
}

export default function MarketplacePage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase
          .from("storyverse_stories")
          .select("id, title, description, genre, cover_color, status")
          .eq("status", "MARKETPLACE")
          .order("updated_at", { ascending: false });
        setStories((data as unknown as Story[]) ?? []);
      } catch { /* empty */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <Container className="py-8">
      <PageHeader
        title="Marketplace"
        description="Browse and purchase published StoryVerse stories."
        icon={<Store className="h-5 w-5" />}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stories.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <Link key={story.id} href={`/storyverse/marketplace/${story.id}`}>
              <Card interactive>
                <CardContent className="space-y-2">
                  <div className={`h-32 rounded-lg bg-${story.cover_color}-500/10 flex items-center justify-center`}>
                    <span className="text-4xl">📖</span>
                  </div>
                  <Badge tone="info">{story.genre}</Badge>
                  <h3 className="font-semibold text-foreground">{story.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{story.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">Read more</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No stories are listed in the marketplace yet.</p>
        </div>
      )}
    </Container>
  );
}
