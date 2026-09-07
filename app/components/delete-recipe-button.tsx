"use client";

// Delete needs a confirm step and somewhere to put "that didn't work", so it's
// a small Client Component rather than a plain <form action>. The bound Server
// Action still does the delete + redirect; a thrown error (DB down) is caught
// here and shown as a toast, leaving the user on the recipe.

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DeleteRecipeButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Delete this recipe? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await action();
      } catch {
        toast.error("Couldn't delete the recipe. Try again in a moment.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Deleting..." : "Delete"}
    </Button>
  );
}
