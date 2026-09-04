// Read-side helpers, shared by any Server Component that needs one recipe.
// Mirrors actions.ts (the write side) but has no "use server": these are plain
// functions called directly during render, not invoked over the network.

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { recipes } from "@/db/schema";

export async function getRecipeById(id: string) {
  // id is a uuid column; a malformed id makes Postgres throw. Treat that the
  // same as "not found" rather than crashing the page.
  try {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe ?? null;
  } catch {
    return null;
  }
}
