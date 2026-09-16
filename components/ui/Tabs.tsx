"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Optional live badge: unread count shown on the tab. */
  badge?: number;
  /** Visual weight of the badge ("alert" = red dot style for important events). */
  badgeTone?: "count" | "alert";
}

export function Tabs({
  items,
  active,
  onChange,
  className = "",
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  "ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-[18px]",
                  item.badgeTone === "alert"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-accent text-accent-foreground",
                )}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
