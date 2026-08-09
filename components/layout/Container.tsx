import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export function BlueprintNote({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-foreground",
        className,
      )}
      role="status"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}
