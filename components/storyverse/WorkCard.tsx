import Link from "next/link";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import type { StoryWork } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Feedback";
import { accent } from "@/components/ui/Accent";
import { cn } from "@/lib/utils";

export function WorkCard({ work }: { work: StoryWork }) {
  const a = accent(work.coverColor);
  return (
    <Link href={`/storyverse/read/${work.id}`}>
      <Card interactive className="h-full">
        <div className="flex h-full flex-col">
          <div
            className={cn(
              "flex h-28 items-end rounded-t-xl bg-gradient-to-br p-4",
              a.solid,
            )}
          >
            <div className="text-white">
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">
                {work.genre}
              </p>
              <h3 className="text-lg font-bold leading-tight">{work.title}</h3>
            </div>
          </div>
          <div className="flex flex-1 flex-col p-4">
            <p className="flex-1 text-sm text-muted-foreground">
              {work.synopsis}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {work.contributors}
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> {work.chapters} chapters
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={work.progress} label="Story progress" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge
                tone={
                  work.status === "Published"
                    ? "success"
                    : work.status === "In Review"
                      ? "warning"
                      : work.status === "In Progress"
                        ? "info"
                        : "neutral"
                }
              >
                {work.status}
              </Badge>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                View <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
