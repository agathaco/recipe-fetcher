"use client";

// Wraps the shared recipe fields in a form backed by `useActionState`, so a
// failed save (validation or a database hiccup) comes back as an inline message
// and keeps everything the user typed, instead of throwing the page away.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { RecipeFields } from "@/components/recipe-fields";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/app/lib/actions";

type Defaults = Parameters<typeof RecipeFields>[0]["defaults"];

function SubmitButton({ label }: { label: string }) {
  // useFormStatus reads the pending state of the nearest enclosing <form>.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function RecipeForm({
  action,
  defaults,
  allTags,
  submitLabel,
  sourceType,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Defaults;
  allTags: string[];
  submitLabel: string;
  // Only the "add" form sends this (manual / web).
  sourceType?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="mt-6">
      {sourceType && <input type="hidden" name="sourceType" value={sourceType} />}
      <RecipeFields allTags={allTags} defaults={defaults} />
      {state.error && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive mt-6 rounded-lg border px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      )}
      <div className="mt-6">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
