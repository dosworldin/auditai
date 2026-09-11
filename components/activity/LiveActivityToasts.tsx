"use client";

import { useEffect, useState } from "react";
import { HeartPulse, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useActivityEvents, useAdminOpsEvents, type ActivityEvent } from "@/lib/activity/useActivityEvents";

/**
 * Live activity toasts (bottom-left).
 *
 * Audience rules:
 *  - Guests (signed-out): social-proof popups about tools/labs.
 *  - Signed-in users: NOTHING — popups read as noise to active users.
 *  - Admins: a calm system heartbeat ("everything is working") instead, so
 *    they always know the platform is healthy. No social-proof mixing.
 */
export function LiveActivityToasts() {
  const { user, profile, loading } = useAuth();
  const isAdmin = Boolean(user && profile?.role === "admin");
  const isGuest = !loading && !user;

  // Hooks must run unconditionally — gating happens via flags below.
  const social = useActivityEvents(isGuest, "guest");
  const ops = useAdminOpsEvents(isAdmin);

  const [animateIn, setAnimateIn] = useState(false);
  const event: ActivityEvent | null = social.event;

  const showSocial = isGuest && social.visible && Boolean(event);
  const showOps = isAdmin && ops.visible && Boolean(ops.event);
  const currentId = showOps ? ops.event?.id : event?.id;

  useEffect(() => {
    if ((showSocial || showOps) && currentId) {
      const t = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(t);
    }
    setAnimateIn(false);
  }, [showSocial, showOps, currentId]);

  if (showOps && ops.event) {
    return (
      <div
        key={ops.event.id}
        aria-live="polite"
        className={`fixed bottom-4 left-4 z-40 max-w-[340px] hidden md:block transition-all duration-500 ${
          animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="flex items-start gap-3 rounded-xl border border-info/40 bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
              {ops.event.title}
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
            </p>
            <p className="text-xs text-muted-foreground">{ops.event.detail}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSocial && event) {
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

  return null;
}
