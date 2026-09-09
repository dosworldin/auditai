"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ACTIVITY_NAMES,
  ACTIVITY_COUNTRIES,
  ACTIVITY_TOOLS,
  ACTIVITY_LABS,
  type ActivityEntry,
} from "@/lib/activity/data";

export interface ActivityEvent {
  id: number;
  /** "Ananya from Mumbai, India" */
  who: string;
  /** "used Salary Slip Audit" / "tried Dream Decoder" */
  what: string;
  flag: string;
}

/**
 * Deck-based no-repeat generator: each pool is shuffled into a deck; cards are
 * popped one at a time so nothing repeats until the deck is exhausted, then
 * the deck reshuffles (Fisher–Yates). Combination draws (name × place ×
 * tool) make full-sentence repeats astronomically unlikely.
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

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck<T>(items: T[]): Deck<T> {
  return new Deck(items);
}

const MIN_GAP_MS = 5_000;
const MAX_GAP_MS = 15_000;
const SHOW_MS = 6_000;

export function useActivityEvents(enabled: boolean = true) {
  const [event, setEvent] = useState<ActivityEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idRef = useRef(0);
  const mountedRef = useRef(true);

  const nameDeck = useRef<Deck<string> | null>(null);
  const placeDeck = useRef<Deck<ActivityEntry> | null>(null);
  const kindDeck = useRef<Deck<"tool" | "lab"> | null>(null);
  const toolDeck = useRef<Deck<string> | null>(null);
  const labDeck = useRef<Deck<string> | null>(null);

  if (nameDeck.current === null) {
    nameDeck.current = makeDeck(ACTIVITY_NAMES);
    placeDeck.current = makeDeck(ACTIVITY_COUNTRIES);
    kindDeck.current = makeDeck(["tool", "tool", "tool", "tool", "lab"] as ("tool" | "lab")[]);
    toolDeck.current = makeDeck(ACTIVITY_TOOLS);
    labDeck.current = makeDeck(ACTIVITY_LABS);
  }

  const scheduleNext = useCallback((delayMs: number) => {
    const t = setTimeout(() => {
      if (!mountedRef.current) return;

      const name = nameDeck.current!.next();
      const place = placeDeck.current!.next();
      const kind = kindDeck.current!.next();
      const subject = kind === "tool" ? toolDeck.current!.next() : labDeck.current!.next();

      idRef.current += 1;
      setEvent({
        id: idRef.current,
        who: `${name} from ${place.city}, ${place.country}`,
        what: kind === "tool" ? `just used ${subject}` : `just tried ${subject}`,
        flag: place.flag,
      });
      setVisible(true);

      const hideT = setTimeout(() => {
        if (!mountedRef.current) return;
        setVisible(false);
        scheduleNext(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
      }, SHOW_MS);
      timers.current.push(hideT);
    }, delayMs);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;
    // First popup arrives quickly so visitors see it, then 5–15s random gaps.
    scheduleNext(4_000);
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [enabled, scheduleNext]);

  return { event, visible };
}
