import { Plus } from "lucide-react";
import Link from "next/link";

import { SearchBox } from "@/app/components/search-box";
import { WantToMakeToggle } from "@/app/components/want-to-make-toggle";
import { badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { logout } from "@/app/lib/actions";
import { getAllTagNames, getRecipes } from "@/app/lib/data";

export const dynamic = "force-dynamic";

function field(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Builds an href that keeps the other active filter alive, e.g. clicking a tag
// while a search is active keeps the search term in the URL too.
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
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            Add recipe
          </Link>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {/* The GET form is the no-JS fallback (Enter still navigates to /?q=...).
          With JS, SearchBox updates the URL live on each debounced keystroke. */}
      <form method="get" className="mt-5">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <SearchBox />
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>

      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link
            href={filterHref(undefined, q)}
            className={badgeVariants({ variant: !tag ? "default" : "secondary" })}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={filterHref(t, q)}
              className={badgeVariants({ variant: t === tag ? "default" : "secondary" })}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {allRecipes.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-sm">
          {tag || q ? (
            "No recipes match that filter."
          ) : (
            <>
              Nothing here yet.{" "}
              <Link href="/recipes/new" className="underline">
                Add one
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <ul className="mt-6 divide-y">
          {allRecipes.map((recipe) => (
            <li key={recipe.id} className="flex gap-3 py-4">
              {recipe.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- external, not worth optimizing
                <img
                  src={recipe.imageUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="font-medium hover:underline"
                  >
                    {recipe.title}
                  </Link>
                  <WantToMakeToggle recipeId={recipe.id} initialValue={recipe.wantToMake} />
                </div>
                {recipe.ingredients && (
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                    {recipe.ingredients.split("\n").filter(Boolean).join(", ")}
                  </p>
                )}
                {recipe.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {recipe.tags.map((t) => (
                      <span
                        key={t}
                        className={badgeVariants({ variant: "outline", className: "text-muted-foreground" })}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
