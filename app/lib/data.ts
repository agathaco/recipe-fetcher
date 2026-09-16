// Read-side helpers, shared by any Server Component that needs recipes.
// Mirrors actions.ts (the write side) but has no "use server": these are plain
// functions called directly during render, not invoked over the network.

import { asc, desc, eq, ilike, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { recipeTags, recipes, tags } from "@/db/schema";

// Postgres's LIKE/ILIKE treats "%" and "_" as wildcards even inside a literal
// search term, and "\" as its own escape character. Escape all three so a
// title like "50% Whole Wheat Bread" is matched literally instead of "%"
// being read as "anything here".
function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Wrapped in React.cache so the detail page's generateMetadata and the page
// body share one query per request instead of hitting the DB twice.
export const getRecipeById = cache(async (id: string) => {
  // `id` is a uuid column and Postgres throws on a malformed value. Bail early
  // so a bad URL reads as "not found"; a query that fails for any other reason
  // is a real problem and is left to reach the error boundary, not disguised
  // as a missing recipe.
  if (!UUID_RE.test(id)) return null;

  // Drizzle's relational query API (the `with` option): a single query that
  // walks recipe -> recipe_tag -> tag using the relations() defined in
  // schema.ts. Reasonable here because there's no cross-table filtering,
  // just "give me this one recipe and everything attached to it."
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
    with: {
      recipeTags: { with: { tag: true } },
      images: { orderBy: (images, { asc }) => [asc(images.createdAt)] },
    },
  });
  if (!recipe) return null;
  return { ...recipe, tags: recipe.recipeTags.map((rt) => rt.tag.name) };
});

export async function getAllTagNames(): Promise<string[]> {
  const rows = await db.select({ name: tags.name }).from(tags).orderBy(tags.name);
  return rows.map((r) => r.name);
}

type RecipeWithTags = typeof recipes.$inferSelect & { tags: string[] };

export type RecipeSort = "date" | "name" | "rating";

// Order-by expression per sort option. Chosen in SQL, before the join fans
// out and gets grouped below, so it's one ORDER BY, not a JS sort afterwards.
function orderByFor(sort: RecipeSort | undefined) {
  switch (sort) {
    case "name":
      return asc(recipes.title);
    case "rating":
      // Postgres defaults DESC to NULLS FIRST, which would put every unrated
      // recipe ahead of every rated one. Drizzle's asc()/desc() don't expose a
      // nulls option on a plain column (only on index definitions), so this is
      // a raw SQL fragment instead.
      return sql`${recipes.rating} DESC NULLS LAST`;
    case "date":
    default:
      return desc(recipes.createdAt);
  }
}

export async function getRecipes(filters: {
  tag?: string;
  q?: string;
  sort?: RecipeSort;
}): Promise<RecipeWithTags[]> {
  // Manual join instead of the relational query API: a LEFT JOIN fans out to
  // one row per (recipe, tag) pair, grouped back into one row per recipe below.
  // The search term is on the base `recipe` row so it goes straight into SQL as
  // an ILIKE (case-insensitive LIKE); the tag filter is applied after grouping.
  const rows = await db
    .select({ recipe: recipes, tagName: tags.name })
    .from(recipes)
    .leftJoin(recipeTags, eq(recipeTags.recipeId, recipes.id))
    .leftJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(filters.q ? ilike(recipes.title, `%${escapeLikePattern(filters.q)}%`) : undefined)
    .orderBy(orderByFor(filters.sort));

  const byId = new Map<string, RecipeWithTags>();
  for (const row of rows) {
    const existing = byId.get(row.recipe.id);
    if (existing) {
      if (row.tagName) existing.tags.push(row.tagName);
    } else {
      byId.set(row.recipe.id, { ...row.recipe, tags: row.tagName ? [row.tagName] : [] });
    }
  }
  const result = Array.from(byId.values());

  // Filter by tag in JS, after grouping. A SQL WHERE on the tag would drop the
  // matching recipe's *other* tags, since the join produces one row per tag.
  const wantedTag = filters.tag;
  return wantedTag ? result.filter((r) => r.tags.includes(wantedTag)) : result;
}
