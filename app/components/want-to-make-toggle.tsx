"use client";

// A toggle needs to feel instant, so it holds optimistic state in the browser
// and calls the Server Action directly. One of the few Client Components here.

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "cn";
import { toggleWantToMake } from "@/app/lib/actions";

export function WantToMakeToggle({
  recipeId,
  initialValue,
}: {
  recipeId: string;
  initialValue: boolean;
}) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(initialValue);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimisticValue;
    startTransition(async () => {
      setOptimisticValue(next);
      try {
        await toggleWantToMake(recipeId, next);
      } catch {
        toast.error("Couldn't update this recipe. Try again.");
      }
    });
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
