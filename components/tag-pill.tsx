import { cn } from "cn";

// A stable colour per tag name, so "dessert" is always the same pink everywhere.
// Full class strings (not built dynamically) so Tailwind's scanner keeps them.
// 14 hues spread around the wheel (skipping straight red/yellow/green, which sit
// too close to rose/amber/emerald to read as distinct) for real variety once you
// have more than a handful of tags.
const TAG_COLORS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
];

export function tagColorClasses(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export function TagPill({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tagColorClasses(name),
        className,
      )}
    >
      {name}
    </span>
  );
}
