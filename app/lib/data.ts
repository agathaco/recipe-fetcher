// Read-side helpers, shared by any Server Component that needs recipes.
// Mirrors actions.ts (the write side) but has no "use server": these are plain
// functions called directly during render, not invoked over the network.

import { and, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { recipeTags, recipes, tags } from "@/db/schema";

export async function getRecipeById(id: string) {
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
}

export async function getAllTagNames(): Promise<string[]> {
  const rows = await db.select({ name: tags.name }).from(tags).orderBy(tags.name);
  return rows.map((r) => r.name);
}

type RecipeWithTags = typeof recipes.$inferSelect & { tags: string[] };

export async function getRecipes(filters: {
  tag?: string;
  q?: string;
}): Promise<RecipeWithTags[]> {
  // The search term applies to the base `recipe` row, so it goes straight into
  // SQL as a WHERE clause. ILIKE = case-insensitive LIKE, a Postgres extension.
  const conditions = filters.q ? [ilike(recipes.title, `%${filters.q}%`)] : [];

  // Manual join instead of the relational query API here: a LEFT JOIN fans
  // out to one row per (recipe, tag) pair, which is exactly what filtering by
  // tag needs to reason about, but the query API's `where` can't easily
  // filter on a nested relation. Grouped back into one row per recipe below.
  const rows = await db
    .select({ recipe: recipes, tagName: tags.name })
    .from(recipes)
    .leftJoin(recipeTags, eq(recipeTags.recipeId, recipes.id))
    .leftJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(conditions.length ? and(...conditions) : undefined)
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
  let result = Array.from(byId.values());

  // Filtering by tag happens in JS, after grouping: doing it in the SQL WHERE
  // clause would drop the *other* tags of a matching recipe, since the join
  // produces one row per tag and the filter would remove all but the matching one.
  if (filters.tag) {
    result = result.filter((r) => r.tags.includes(filters.tag!));
  }

  return result;
}
