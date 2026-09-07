import { Star } from "lucide-react";

import { cn } from "cn";

// Read-only star display for recipe cards. Not interactive, so no "use client".
export function StarRow({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={cn(
            "size-3.5",
            v <= value
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/25 fill-transparent",
          )}
        />
      ))}
    </div>
  );
}
