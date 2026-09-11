"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, BookOpen, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface FlipPage {
  pageNumber: number;
  text: string;
  imageUrl: string;
}

export default function StorybookFlipbook({ slug, title, childName }: {
  slug: string; title: string; childName: string;
}) {
  const [pages, setPages] = useState<FlipPage[] | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [previewPages, setPreviewPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`/api/storybook/public/${slug}`);
        const data = await res.json().catch(() => null);
        if (stop) return;
        if (!res.ok) {
          setError(data?.error ?? "This storybook is no longer shared.");
          return;
        }
        setPages(data.storybook.pages as FlipPage[]);
        setTotalPages(data.storybook.totalPages ?? data.storybook.pages.length);
        setPreviewPages(data.storybook.previewPages ?? data.storybook.pages.length);
      } catch {
        if (!stop) setError("Could not load the storybook.");
      }
    })();
    return () => { stop = true; };
  }, [slug]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!pages) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Opening the book…
        </CardContent>
      </Card>
    );
  }

  const page = pages[Math.min(current, pages.length - 1)];
  const locked = totalPages > previewPages;
  const atPreviewEnd = current >= pages.length - 1 && locked;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">A personalized storybook for {childName}</p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-xl bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={page.pageNumber}
              src={page.imageUrl}
              alt={`Illustration for page ${page.pageNumber}`}
              className="h-full w-full animate-fade-in object-cover"
            />
          </div>

          {page.text ? (
            <p className="mx-auto max-w-2xl text-center text-base leading-relaxed text-foreground sm:text-lg">
              {page.text}
            </p>
          ) : null}

          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page.pageNumber} of {locked ? previewPages : pages.length}
              {locked ? ` (free preview of ${totalPages})` : ""}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrent((c) => Math.min(pages.length - 1, c + 1))}
              disabled={current === pages.length - 1}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {atPreviewEnd ? (
            <div className="mx-auto max-w-md rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center animate-fade-in">
              <Lock className="mx-auto mb-1.5 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">The adventure continues…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pages {previewPages + 1}–{totalPages} are part of the full book, which stays private to {childName}&apos;s family.
              </p>
              <Link href="/storybook" className="mt-3 inline-block">
                <Button size="sm">Make your own storybook →</Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Loved it?{" "}
        <Link href="/storybook" className="font-medium text-primary hover:underline">
          Create a storybook starring your own child →
        </Link>
      </p>
    </div>
  );
}
