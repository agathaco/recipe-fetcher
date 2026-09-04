"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recipes } from "@/db/schema";

// Everything in this file runs only on the server. It is imported by forms and
// invoked over the network as a POST, so it must validate its own input.

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s === "" ? null : s;
}

export async function createRecipe(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) {
    throw new Error("Title is required");
  }

  const [created] = await db
    .insert(recipes)
    .values({
      title,
      sourceUrl: strOrNull(formData.get("sourceUrl")),
      sourceType: "manual",
      ingredients: strOrNull(formData.get("ingredients")),
      steps: strOrNull(formData.get("steps")),
      notes: strOrNull(formData.get("notes")),
      wantToMake: formData.get("wantToMake") === "on",
    })
    .returning();

  // Bust the cached list page so the new recipe shows up.
  revalidatePath("/");
  // Throws a control-flow exception; nothing after this runs.
  redirect(`/recipes/${created.id}`);
}

// The edit form calls this via updateRecipe.bind(null, id), so `id` arrives as
// a real argument and `formData` is still whatever the form submitted.
export async function updateRecipe(id: string, formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) {
    throw new Error("Title is required");
  }

  await db
    .update(recipes)
    .set({
      title,
      sourceUrl: strOrNull(formData.get("sourceUrl")),
      ingredients: strOrNull(formData.get("ingredients")),
      steps: strOrNull(formData.get("steps")),
      notes: strOrNull(formData.get("notes")),
      wantToMake: formData.get("wantToMake") === "on",
    })
    .where(eq(recipes.id, id));

  // Both the list (title/badge can change) and this recipe's own page are stale now.
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

// Same bind pattern: the delete button's form calls deleteRecipe.bind(null, id).
// No FormData needed here, so the bound function takes no other arguments.
export async function deleteRecipe(id: string) {
  await db.delete(recipes).where(eq(recipes.id, id));

  revalidatePath("/");
  redirect("/");
}
