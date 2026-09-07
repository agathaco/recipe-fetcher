// Read-side helpers, shared by any Server Component that needs recipes.
// Mirrors actions.ts (the write side) but has no "use server": these are plain
// functions called directly during render, not invoked over the network.

import { desc, eq, ilike } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { recipeTags, recipes, tags } from "@/db/schema";

// Wrapped in React.cache so the detail page's generateMetadata and the page
// body share one query per request instead of hitting the DB twice.
export const getRecipeById = cache(async (id: string) => {
  // id is a uuid column; a malformed id makes Postgres throw. Treat that the
  // same as "not found" rather than crashing the page.
  try {
    // Drizzle's relational query API (the `with` option): a single query that
    // walks recipe -> recipe_tag -> tag using the relations() defined in
    // schema.ts. Reasonable here because there's no cross-table filtering,
    // just "give me this one recipe and everything attached to it."
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, id),
      with: { recipeTags: { with: { tag: true } } },
    });
    if (!recipe) return null;
    return { ...recipe, tags: recipe.recipeTags.map((rt) => rt.tag.name) };
  } catch {
    return null;
  }
});

export async function getAllTagNames(): Promise<string[]> {
  const rows = await db.select({ name: tags.name }).from(tags).orderBy(tags.name);
  return rows.map((r) => r.name);
}

type RecipeWithTags = typeof recipes.$inferSelect & { tags: string[] };

export async function getRecipes(filters: {
  tag?: string;
  q?: string;
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
    .where(filters.q ? ilike(recipes.title, `%${filters.q}%`) : undefined)
    .orderBy(desc(recipes.createdAt));

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
