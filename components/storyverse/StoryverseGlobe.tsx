"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenText, Globe2, ScrollText, Scale } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GLOBE_COUNTRIES, GLOBE_RULES } from "@/lib/storyverse-globe/data";
import { DEFAULT_GLOBE_TIMING, useStoryverseGlobe } from "@/lib/storyverse-globe/useStoryverseGlobe";

interface GlobeConfigRow {
  enabled?: boolean;
  minGapSeconds?: number;
  maxGapSeconds?: number;
  disappearSeconds?: number;
  initialDelaySeconds?: number;
}

const FALLBACK_CONFIG: Required<Omit<GlobeConfigRow, "enabled">> & { enabled: boolean } = {
  enabled: true,
  minGapSeconds: 5,
  maxGapSeconds: 15,
  disappearSeconds: 7,
  initialDelaySeconds: 3.5,
};

/**
 * StoryVerse "world activity" globe.
 * Flags orbit the globe as community actions happen worldwide (deck-sampled,
 * no repeats), with the platform's StoryVerse rules/terms beside it.
 * Timing is fully admin-controlled via admin_settings:
 * storyverse_globe_enabled, storyverse_globe_min_gap_seconds,
 * storyverse_globe_max_gap_seconds, storyverse_globe_disappear_seconds.
 */
export function StoryverseGlobe() {
  const [cfg, setCfg] = useState<Required<Omit<GlobeConfigRow, "enabled">> & { enabled: boolean }>(
    FALLBACK_CONFIG,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/storyverse/globe-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.config) setCfg({ ...FALLBACK_CONFIG, ...data.config });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timing = useMemo(
    () => ({
      minGapMs: cfg.minGapSeconds * 1000,
      maxGapMs: Math.max(cfg.maxGapSeconds, cfg.minGapSeconds) * 1000,
      disappearMs: cfg.disappearSeconds * 1000,
      initialDelayMs: cfg.initialDelaySeconds * 1000,
    }),
    [cfg],
  );

  const { events } = useStoryverseGlobe(loaded && cfg.enabled, loaded ? timing : DEFAULT_GLOBE_TIMING);

  return (
    <section aria-label="StoryVerse global activity" className="mb-10 grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse at 50% 45%, rgba(var(--primary), 0.08), transparent 65%)",
            }}
          />
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                StoryVerse around the world
              </h2>
            </div>
            <Badge tone="info">live</Badge>
          </div>

          <div className="relative mx-auto aspect-[16/9] w-full">
            {/* Globe body */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[78%] w-[78%] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, rgba(var(--primary), 0.14), rgba(var(--card), 1) 70%)",
              }}
            />
            {/* Latitude guides */}
            <div aria-hidden="true" className="absolute inset-0">
              {[18, 32, 46, 60, 74].map((top) => (
                <div
                  key={top}
                  className="absolute left-1/2 h-px w-[62%] -translate-x-1/2 border-t border-dashed border-border/70"
                  style={{ top: `${top}%` }}
                />
              ))}
            </div>
            {/* Event pins */}
            {events.map((ev) => (
              <div
                key={ev.id}
                className="absolute z-10 flex max-w-[92%] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-border bg-card/95 py-1 pl-1 pr-2.5 shadow-md animate-fade-in"
                style={{ left: `${ev.place.x}%`, top: `${ev.place.y}%` }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-sm leading-none"
                  role="img"
                  aria-label={ev.place.country}
                >
                  {ev.place.flag}
                </span>
                <span className="whitespace-nowrap text-xs font-medium text-foreground">
                  <span className="font-semibold">{ev.place.city}</span>{" "}
                  <span className="text-muted-foreground">{ev.action}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Writers and readers from {GLOBE_COUNTRIES.length}+ countries use StoryVerse every day
            </span>
            <Link href="/storyverse/create" className="font-medium text-primary hover:underline">
              Join them →
            </Link>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="h-full rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              How StoryVerse works
            </h2>
          </div>
          <ul className="space-y-3">
            {GLOBE_RULES.map((rule) => (
              <li key={rule.label} className="flex gap-2.5">
                <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{rule.label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{rule.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
            <BookOpenText className="h-3.5 w-3.5 text-muted-foreground" />
            <Link href="/terms" className="text-xs font-medium text-primary hover:underline">
              Read the full Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
