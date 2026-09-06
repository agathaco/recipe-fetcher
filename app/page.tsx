import Link from "next/link";

import { WantToMakeToggle } from "@/app/components/want-to-make-toggle";
import { logout } from "@/app/lib/actions";
import { getAllTagNames, getRecipes } from "@/app/lib/data";

// Always render on request so new recipes show up immediately.
// The proper caching model (revalidatePath etc.) is days 5-6.
export const dynamic = "force-dynamic";

function field(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Builds an href that keeps the other active filter alive, e.g. clicking a
// tag while a search is active keeps the search term in the URL too.
function filterHref(tag: string | undefined, q: string | undefined): string {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function HomePage({
  searchParams,
}: {
  // searchParams is a page prop, just like params, and is also a Promise.
  // Next.js: this is what makes reading the URL's query string a first-class
  // Server Component concern, no client-side router hook needed.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tag = field(params.tag);
  const q = field(params.q);

  const [allRecipes, allTags] = await Promise.all([
    getRecipes({ tag, q }),
    getAllTagNames(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <div className="flex shrink-0 items-baseline gap-3 text-sm">
          <Link href="/recipes/new" className="font-medium text-blue-600 hover:underline">
            + Add recipe
          </Link>
          <form action={logout}>
            <button type="submit" className="text-gray-400 hover:text-gray-600 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* A plain GET form. No onSubmit, no state, no "use client": the browser
          itself turns this into a navigation to /?q=whatever-was-typed. The
          URL becomes the search state, which is why there's nothing to wire up. */}
      <form method="get" className="mt-4 flex gap-2">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search titles..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200"
        >
          Search
        </button>
      </form>

      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link
            href={filterHref(undefined, q)}
            className={!tag ? "font-semibold underline" : "text-gray-500 hover:underline"}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={filterHref(t, q)}
              className={t === tag ? "font-semibold underline" : "text-gray-500 hover:underline"}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {allRecipes.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          {tag || q ? (
            "No recipes match that filter."
          ) : (
            <>
              Nothing here yet. Run <code>npm run db:seed</code> or add one.
            </>
          )}
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
                <WantToMakeToggle recipeId={recipe.id} initialValue={recipe.wantToMake} />
              </div>
              {recipe.ingredients && (
                <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                  {recipe.ingredients.split("\n").join(", ")}
                </p>
              )}
              {recipe.tags.length > 0 && (
                <p className="mt-1 text-xs text-gray-400">{recipe.tags.join(", ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
