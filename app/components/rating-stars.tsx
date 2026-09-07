"use client";

// Interactive 1-5 star rating on the detail page. Same instant-feedback reason
// as the want-to-make toggle: hover preview and an optimistic update, backed by
// a Server Action. Clicking the current rating again clears it.

import { Star } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { cn } from "cn";
import { setRating } from "@/app/lib/actions";

export function RatingStars({
  recipeId,
  initialValue,
}: {
  recipeId: string;
  initialValue: number;
}) {
  const [optimistic, setOptimistic] = useOptimistic(initialValue);
  const [hover, setHover] = useState(0);
  const [, startTransition] = useTransition();

  const shown = hover || optimistic;

  function rate(value: number) {
    const next = value === optimistic ? 0 : value;
    startTransition(async () => {
      setOptimistic(next);
      await setRating(recipeId, next);
    });
  }

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`Rate ${value} out of 5`}
          aria-pressed={value === optimistic}
          onMouseEnter={() => setHover(value)}
          onFocus={() => setHover(value)}
          onClick={() => rate(value)}
          className="rounded p-0.5"
        >
          <Star
            className={cn(
              "size-5 transition-colors",
              value <= shown
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/35 fill-transparent",
            )}
          />
        </button>
      ))}
    </div>
  );
}
