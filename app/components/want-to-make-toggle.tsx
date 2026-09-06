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
}: {
  recipeId: string;
  initialValue: boolean;
}) {
  // Seeded from the server-rendered value. useTransition marks the Server
  // Action call as a transition, which is what lets useOptimistic apply its
  // value immediately and revert once the real re-render arrives.
  const [optimisticValue, setOptimisticValue] = useOptimistic(initialValue);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimisticValue;
    startTransition(async () => {
      setOptimisticValue(next);
      await toggleWantToMake(recipeId, next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={optimisticValue}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        optimisticValue
          ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          : "text-muted-foreground hover:bg-muted border-transparent",
      )}
    >
      <Star className={cn("size-3", optimisticValue && "fill-current")} />
      want to make
    </button>
  );
}
