import type { LucideIcon } from "lucide-react";
import { accent } from "@/components/ui/Accent";
import { cn } from "@/lib/utils";

export function ToolIcon({
  icon: Icon,
  accentKey,
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  accentKey: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const a = accent(accentKey);
  const sizes = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-14 w-14 rounded-2xl",
  };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizes[size],
        a.icon,
        className,
      )}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
    </span>
  );
}
