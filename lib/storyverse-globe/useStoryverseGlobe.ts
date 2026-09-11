"use client";

import { useEffect, useRef, useState } from "react";
import { GLOBE_ACTIONS, GLOBE_COUNTRIES, type GlobeEntry } from "@/lib/storyverse-globe/data";

export interface GlobeEvent {
  id: number;
  place: GlobeEntry;
  action: string;
}

/** Admin-configurable timing (seconds in admin settings, ms here). */
export interface GlobeTiming {
  minGapMs: number;
  maxGapMs: number;
  /** How long a pin stays visible after appearing. */
  disappearMs: number;
  /** Delay before the first pin appears. */
  initialDelayMs: number;
}

export const DEFAULT_GLOBE_TIMING: GlobeTiming = {
  minGapMs: 5_000,
  maxGapMs: 15_000,
  disappearMs: 7_000,
  initialDelayMs: 3_500,
};

/**
 * Deck-based no-repeat sampler — same approach as lib/activity/useActivityEvents.
 * Pools are shuffled; cards are popped so nothing repeats until a deck is
 * exhausted, then it reshuffles (Fisher–Yates).
 */
class Deck<T> {
  private source: T[];
  private items: T[];
  constructor(items: T[]) {
    this.source = items;
    this.items = shuffle(items);
  }
  next(): T {
    if (this.items.length === 0) this.items = shuffle(this.source);
    return this.items.pop() as T;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useStoryverseGlobe(enabled: boolean, timing: GlobeTiming = DEFAULT_GLOBE_TIMING) {
  const [events, setEvents] = useState<GlobeEvent[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idRef = useRef(0);
  const mountedRef = useRef(true);

  const placeDeck = useRef<Deck<GlobeEntry> | null>(null);
  const actionDeck = useRef<Deck<string> | null>(null);
  if (placeDeck.current === null) {
    placeDeck.current = new Deck(GLOBE_COUNTRIES);
    actionDeck.current = new Deck<string>([...GLOBE_ACTIONS]);
  }

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      const t = setTimeout(() => {
        if (cancelled || !mountedRef.current) return;
        const place = placeDeck.current!.next();
        const action = actionDeck.current!.next();

        idRef.current += 1;
        const id = idRef.current;
        setEvents((prev) => [...prev.slice(-14), { id, place, action }]);

        // Pin disappears after the admin-configured display time, then the
        // next pin appears after a random gap between minGap and maxGap.
        const hideT = setTimeout(() => {
          if (cancelled || !mountedRef.current) return;
          setEvents((prev) => prev.filter((e) => e.id !== id));
          scheduleNext(
            timing.minGapMs + Math.random() * Math.max(0, timing.maxGapMs - timing.minGapMs),
          );
        }, timing.disappearMs);
        timers.current.push(hideT);
      }, delayMs);
      timers.current.push(t);
    };

    scheduleNext(timing.initialDelayMs);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [enabled, timing]);

  return { events };
}
