import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { recipes } from "@/db/schema";

export const dynamic = "force-dynamic";

// A dynamic route: [id] is a URL segment. `params` is a Promise in Next 15+.
async function getRecipe(id: string) {
  // The id column is a uuid. A malformed id makes Postgres throw, so treat
  // that the same as "not found" rather than crashing the page.
  try {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, id));
    return recipe ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  return { title: recipe ? recipe.title : "Recipe not found" };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        &larr; All recipes
      </Link>

      <div className="mt-4 flex items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
        {recipe.wantToMake && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            want to make
          </span>
        )}
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
