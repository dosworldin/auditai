"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ACTIVITY_NAMES,
  ACTIVITY_COUNTRIES,
  ACTIVITY_TOOLS,
  ACTIVITY_LABS,
  type ActivityEntry,
} from "@/lib/activity/data";

export type ActivityAudience = "guest" | "admin";

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

/**
 * Ambience activity events.
 *
 * audience = "guest" → social proof popups (tools/labs) for signed-out
 * visitors. Signed-in users never see these (it reads as noise to someone
 * already using the product); admins instead get ops/system events via the
 * admin feed in LiveActivityToasts.
 */
export function useActivityEvents(
  enabled: boolean = true,
  audience: ActivityAudience = "guest",
) {
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
    if (audience !== "guest") return; // logged-in users: handled by admin/system feed

    // First popup arrives quickly so visitors see it, then 5–15s random gaps.
    scheduleNext(4_000);
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [enabled, audience, scheduleNext]);

  return { event, visible };
}

/* ------------------------------------------------------------------ */
/* Admin ops feed — lightweight system heartbeat popups               */
/* ------------------------------------------------------------------ */

export interface AdminOpsEvent {
  id: number;
  title: string;
  detail: string;
}

const OPS_CHECKS: { title: string; detail: string }[] = [
  { title: "AI provider chain healthy", detail: "Primary + fallback responding within budget" },
  { title: "Storybook pipeline idle", detail: "No stuck orders — all under time budget" },
  { title: "Credit ledger in sync", detail: "Balances match ledger totals (last sweep)" },
  { title: "Storage bucket reachable", detail: "storybook-assets signed URLs issuing correctly" },
  { title: "Email delivery nominal", detail: "Transactional queue empty, no bounces" },
  { title: "Rate limiter warm", detail: "Abuse guards active on AI-heavy routes" },
  { title: "POD gateway reachable", detail: "Print API auth refreshed successfully" },
  { title: "Voice narration ready", detail: "TTS quota OK — narration jobs finishing" },
];

/** System heartbeat events for ADMIN sessions only (ops reassurance). */
export function useAdminOpsEvents(enabled: boolean) {
  const [event, setEvent] = useState<AdminOpsEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idRef = useRef(0);
  const deck = useRef<Deck<{ title: string; detail: string }> | null>(null);
  if (deck.current === null) deck.current = new Deck(OPS_CHECKS);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const schedule = (delayMs: number) => {
      const t = setTimeout(() => {
        if (!alive) return;
        const check = deck.current!.next();
        idRef.current += 1;
        setEvent({ id: idRef.current, ...check });
        setVisible(true);
        const hide = setTimeout(() => {
          if (!alive) return;
          setVisible(false);
          schedule(25_000 + Math.random() * 35_000);
        }, 5_000);
        timers.current.push(hide);
      }, delayMs);
      timers.current.push(t);
    };

    schedule(6_000);
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [enabled]);

  return { event, visible };
}
