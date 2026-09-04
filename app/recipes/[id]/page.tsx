import Link from "next/link";
import { notFound } from "next/navigation";

import { WantToMakeToggle } from "@/app/components/want-to-make-toggle";
import { deleteRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";

export const dynamic = "force-dynamic";

// A dynamic route: [id] is a URL segment. `params` is a Promise in Next 15+.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  return { title: recipe ? recipe.title : "Recipe not found" };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  // Bound in this Server Component so the rendered form already knows which
  // recipe to delete, with no hidden "id" input needed.
  const deleteThisRecipe = deleteRecipe.bind(null, recipe.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        &larr; All recipes
      </Link>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
          <WantToMakeToggle recipeId={recipe.id} initialValue={recipe.wantToMake} />
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <Link href={`/recipes/${recipe.id}/edit`} className="text-blue-600 hover:underline">
            Edit
          </Link>
          <form action={deleteThisRecipe}>
            <button type="submit" className="text-red-600 hover:underline">
              Delete
            </button>
          </form>
        </div>
      </div>

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm text-blue-600 hover:underline"
        >
          {recipe.sourceType ? `Source (${recipe.sourceType})` : "Source"}
        </a>
      )}

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {recipe.ingredients && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Ingredients
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {recipe.ingredients
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ul>
        </section>
      )}

      {recipe.steps && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Steps
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm">{recipe.steps}</p>
        </section>
      )}

      {recipe.notes && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm">{recipe.notes}</p>
        </section>
      )}
    </main>
  );
}
