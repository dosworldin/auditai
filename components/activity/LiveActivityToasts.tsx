"use client";

import { useEffect, useState } from "react";
import { useActivityEvents } from "@/lib/activity/useActivityEvents";

/**
 * Live activity toasts (bottom-left social proof).
 * No-repeat deck sampling; each popup shows ~6s with random 5–15s gaps.
 */
export function LiveActivityToasts() {
  const { event, visible } = useActivityEvents(true);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (visible && event) {
      const t = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(t);
    }
    setAnimateIn(false);
  }, [visible, event?.id]);

  if (!visible || !event) return null;

  return (
    <div
      key={event.id}
      aria-live="polite"
      className={`fixed bottom-4 left-4 z-40 max-w-[320px] hidden md:block transition-all duration-500 ${
        animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-xl leading-none" role="img" aria-label="flag">
          {event.flag}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{event.who}</p>
          <p className="text-xs text-muted-foreground">{event.what}</p>
        </div>
      </div>
    </div>
  );
}
