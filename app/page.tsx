import { Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { SearchBox } from "@/app/components/search-box";
import { SortSelect } from "@/app/components/sort-select";
import { cn } from "cn";
import { StarRow } from "@/components/star-row";
import { TagPill, tagColorClasses } from "@/components/tag-pill";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserMenu } from "@/app/components/user-menu";
import { getAllTagNames, getRecipes, type RecipeSort } from "@/app/lib/data";
import { param } from "@/app/lib/params";
import { requireCurrentUser } from "@/app/lib/session";

const SORT_VALUES: RecipeSort[] = ["date", "name", "rating"];

function isRecipeSort(value: string | undefined): value is RecipeSort {
  return SORT_VALUES.includes(value as RecipeSort);
}

function filterHref(
  tag: string | undefined,
  q: string | undefined,
  sort: RecipeSort | undefined,
): string {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (q) params.set("q", q);
  if (sort && sort !== "date") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const tag = param(params.tag);
  const q = param(params.q);
  const rawSort = param(params.sort);
  const sort = isRecipeSort(rawSort) ? rawSort : "date";

  const [allRecipes, allTags] = await Promise.all([
    getRecipes({ ownerId: user.id, tag, q, sort }),
    getAllTagNames(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-brand text-3xl font-bold tracking-tight">Recipes</h1>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            Add recipe
          </Link>
          <UserMenu email={user.email} />
        </div>
      </header>

      {/* Plain GET form (no-JS fallback); SearchBox and SortSelect update the URL live with JS. */}
      <form method="get" className="mt-6 flex items-center gap-2">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <SearchBox />
        <SortSelect />
        <button type="submit" className="sr-only">
          Apply
        </button>
      </form>

      {allTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Link
            href={filterHref(undefined, q, sort)}
            className={badgeVariants({ variant: !tag ? "default" : "secondary" })}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={filterHref(t, q, sort)}
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition",
                tagColorClasses(t),
                t === tag
                  ? "ring-foreground/60 ring-2"
                  : "opacity-70 hover:opacity-100",
              )}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {allRecipes.length === 0 ? (
        <p className="text-muted-foreground mt-10 text-sm">
          {tag || q ? (
            "No recipes match that filter."
          ) : (
            <>
              Nothing here yet.{" "}
              <Link href="/recipes/new" className="text-primary underline">
                Add one
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {allRecipes.map((recipe) => (
            // Flat: no ring, no shadow. Separation comes from the grid gap and
            // the image, not elevation. Base <Card> is ring-1 by default, so
            // ring-0 has to come after it in the class string to win the merge.
            <Card key={recipe.id} className="group gap-0 overflow-hidden rounded-lg py-0 ring-0">
              <Link href={`/recipes/${recipe.id}`} className="block">
                <div className="bg-muted aspect-[4/3] overflow-hidden">
                  {recipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external, not worth optimizing
                    <img
                      src={recipe.imageUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="text-muted-foreground/40 flex size-full items-center justify-center">
                      <UtensilsCrossed className="size-8" />
                    </div>
                  )}
                </div>
                <div className="px-3 pt-4 pb-4">
                  <h3 className="text-[15px] leading-snug font-semibold">
                    {recipe.title}
                  </h3>
                  {recipe.rating != null && (
                    <StarRow value={recipe.rating} className="mt-1.5" />
                  )}
                  {recipe.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 3).map((t) => (
                        <TagPill key={t} name={t} />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
