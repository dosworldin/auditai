export interface AccentClasses {
  chip: string;
  dot: string;
  solid: string;
  soft: string;
  ring: string;
  icon: string;
}

export const ACCENTS: Record<string, AccentClasses> = {
  indigo: {
    chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30",
    dot: "bg-indigo-500",
    solid: "bg-indigo-500 text-white hover:bg-indigo-600",
    soft: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    ring: "ring-indigo-500/30",
    icon: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
    dot: "bg-rose-500",
    solid: "bg-rose-500 text-white hover:bg-rose-600",
    soft: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    ring: "ring-rose-500/30",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  sky: {
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
    dot: "bg-sky-500",
    solid: "bg-sky-500 text-white hover:bg-sky-600",
    soft: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    ring: "ring-sky-500/30",
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
    solid: "bg-emerald-500 text-white hover:bg-emerald-600",
    soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    ring: "ring-emerald-500/30",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
    solid: "bg-amber-500 text-white hover:bg-amber-600",
    soft: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    ring: "ring-amber-500/30",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/30",
    dot: "bg-violet-500",
    solid: "bg-violet-500 text-white hover:bg-violet-600",
    soft: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    ring: "ring-violet-500/30",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  teal: {
    chip: "bg-teal-500/10 text-teal-600 dark:text-teal-300 border-teal-500/30",
    dot: "bg-teal-500",
    solid: "bg-teal-500 text-white hover:bg-teal-600",
    soft: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
    ring: "ring-teal-500/30",
    icon: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
  },
  slate: {
    chip: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
    dot: "bg-slate-500",
    solid: "bg-slate-500 text-white hover:bg-slate-600",
    soft: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/30",
    icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};

export function accent(key: string): AccentClasses {
  return ACCENTS[key] ?? ACCENTS.slate;
}
