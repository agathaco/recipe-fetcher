"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recipes } from "@/db/schema";
import { captureFromInstagramUrl, captureFromWebUrl, isInstagramUrl } from "@/app/lib/capture";

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
      sourceType: strOrNull(formData.get("sourceType")) ?? "manual",
      imageUrl: strOrNull(formData.get("imageUrl")),
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

// The "paste a URL" mini-form on the add-recipe page. This never writes to
// the database itself: it fetches, tries to extract a recipe, and hands
// whatever it found to the real add-recipe form via the URL, as searchParams.
// If nothing was found, every field is simply absent and the form is empty,
// the "paste it yourself" rung of the fallback ladder.
export async function importFromUrl(formData: FormData) {
  const url = str(formData.get("importUrl"));
  const params = new URLSearchParams();

  if (url) {
    const instagram = isInstagramUrl(url);
    const captured = instagram ? await captureFromInstagramUrl(url) : await captureFromWebUrl(url);

    params.set("sourceUrl", url);
    params.set("sourceType", instagram ? "instagram" : "web");
    if (!captured) {
      params.set("importFailed", "1");
    } else {
      if (captured.title) params.set("title", captured.title);
      if (captured.ingredients) params.set("ingredients", captured.ingredients);
      if (captured.steps) params.set("steps", captured.steps);
      if (captured.notes) params.set("notes", captured.notes);
      if (captured.imageUrl) params.set("imageUrl", captured.imageUrl);
    }
  }

  // redirect() throws internally, so it must run outside any try/catch —
  // catching it here would swallow the redirect instead of performing it.
  redirect(`/recipes/new?${params.toString()}`);
}
