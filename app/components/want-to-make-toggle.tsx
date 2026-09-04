"use client";

// The one Client Component in this app. Everything else is a Server Component
// with zero client JS; this exists purely because a toggle needs to feel
// instant, and that requires state that lives in the browser.

import { useOptimistic, useTransition } from "react";

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
  // value immediately and then revert once the real re-render arrives.
  const [optimisticValue, setOptimisticValue] = useOptimistic(initialValue);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimisticValue;
    startTransition(async () => {
      // Flips the UI on this frame, before the network request even starts.
      setOptimisticValue(next);
      await toggleWantToMake(recipeId, next);
      // No local reset needed: revalidatePath inside the action causes a
      // fresh server render with the real value, which replaces this
      // optimistic one once it arrives.
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={optimisticValue}
      className={
        optimisticValue
          ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
          : "rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
      }
    >
      {optimisticValue ? "★ want to make" : "☆ want to make"}
    </button>
  );
}
