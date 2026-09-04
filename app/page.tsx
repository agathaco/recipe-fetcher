import Link from "next/link";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { recipes } from "@/db/schema";

// Always render on request so new recipes show up immediately.
// The proper caching model (revalidatePath etc.) is days 5-6.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Runs on the server during render. No fetch, no /api route, no loading state.
  // SELECT * FROM recipe ORDER BY created_at DESC
  const allRecipes = await db
    .select()
    .from(recipes)
    .orderBy(desc(recipes.createdAt));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>

      {allRecipes.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          Nothing here yet. Run <code>npm run db:seed</code> or add one.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200">
          {allRecipes.map((recipe) => (
            <li key={recipe.id} className="py-4">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="font-medium hover:underline"
                >
                  {recipe.title}
                </Link>
                {recipe.wantToMake && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    want to make
                  </span>
                )}
              </div>
              {recipe.ingredients && (
                <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                  {recipe.ingredients.split("\n").join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
