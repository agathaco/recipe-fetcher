import { notFound } from "next/navigation";

import { updateRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  // Binding `id` here, in a Server Component, produces a Server Action reference
  // with `id` already attached. No client JS or "use client" needed for this.
  const updateThisRecipe = updateRecipe.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Edit recipe</h1>

      <form action={updateThisRecipe} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            required
            defaultValue={recipe.title}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Source URL</span>
          <input
            name="sourceUrl"
            type="url"
            defaultValue={recipe.sourceUrl ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Ingredients</span>
          <textarea
            name="ingredients"
            rows={6}
            defaultValue={recipe.ingredients ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Steps</span>
          <textarea
            name="steps"
            rows={6}
            defaultValue={recipe.steps ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={recipe.notes ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Tags</span>
          <input
            name="tags"
            defaultValue={recipe.tags.join(", ")}
            placeholder="dessert, quick, vegetarian"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-gray-500">Comma-separated</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="wantToMake" defaultChecked={recipe.wantToMake} />
          Want to make
        </label>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Save changes
        </button>
      </form>
    </main>
  );
}
