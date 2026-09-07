import { Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { SearchBox } from "@/app/components/search-box";
import { WantToMakeToggle } from "@/app/components/want-to-make-toggle";
import { StarRow } from "@/components/star-row";
import { badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logout } from "@/app/lib/actions";
import { getAllTagNames, getRecipes } from "@/app/lib/data";

export const dynamic = "force-dynamic";

function field(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

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
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-brand text-3xl font-bold tracking-tight">Recipes</h1>
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

      {/* Plain GET form (no-JS fallback); SearchBox updates the URL live. */}
      <form method="get" className="mt-6">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <SearchBox />
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>

      {allTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-lg"
            >
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
                <div className="px-4 pt-4 pb-4">
                  <h3 className="text-[15px] leading-snug font-semibold">
                    {recipe.title}
                  </h3>
                  {recipe.rating != null && (
                    <StarRow value={recipe.rating} className="mt-1.5" />
                  )}
                  {recipe.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className={badgeVariants({
                            variant: "outline",
                            className: "text-muted-foreground",
                          })}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
              <div className="absolute top-2.5 right-2.5">
                <WantToMakeToggle recipeId={recipe.id} initialValue={recipe.wantToMake} compact />
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
