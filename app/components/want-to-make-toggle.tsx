"use client";

// The one Client Component in this app. Everything else is a Server Component
// with zero client JS; this exists purely because a toggle needs to feel
// instant, and that requires state that lives in the browser.

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { cn } from "cn";
import { toggleWantToMake } from "@/app/lib/actions";

export function WantToMakeToggle({
  recipeId,
  initialValue,
  compact = false,
}: {
  recipeId: string;
  initialValue: boolean;
  // compact = circular icon button, for the corner of a recipe card.
  // default = labelled pill, for the detail page.
  compact?: boolean;
}) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(initialValue);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimisticValue;
    startTransition(async () => {
      setOptimisticValue(next);
      await toggleWantToMake(recipeId, next);
    });
  }

  const label = optimisticValue ? "Remove from want to make" : "Add to want to make";

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={optimisticValue}
        aria-label={label}
        title={label}
        className={cn(
          "flex size-8 items-center justify-center rounded-full backdrop-blur transition",
          optimisticValue
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "bg-black/40 text-white hover:bg-black/60",
        )}
      >
        <Star className={cn("size-4", optimisticValue && "fill-current")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={optimisticValue}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        optimisticValue
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          : "text-muted-foreground hover:bg-muted border-border",
      )}
    >
      <Star className={cn("size-3.5", optimisticValue && "fill-current")} />
      Want to make
    </button>
  );
}
