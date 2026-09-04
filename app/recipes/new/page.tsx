import Link from "next/link";

import { createRecipe } from "@/app/lib/actions";

export const metadata = { title: "Add a recipe" };

export default function NewRecipePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        &larr; All recipes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Add a recipe</h1>

      {/* Plain form + Server Action: submits even with JS disabled. */}
      <form action={createRecipe} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Source URL</span>
          <input
            name="sourceUrl"
            type="url"
            placeholder="https://"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Ingredients</span>
          <textarea
            name="ingredients"
            rows={6}
            placeholder="One per line"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Steps</span>
          <textarea
            name="steps"
            rows={6}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            name="notes"
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="wantToMake" />
          Want to make
        </label>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Save recipe
        </button>
      </form>
    </main>
  );
}
