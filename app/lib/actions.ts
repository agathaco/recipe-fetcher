"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recipeTags, recipes, tags } from "@/db/schema";
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

// Replaces a recipe's whole tag set with the comma-separated list from the
// form. Delete-then-reinsert is the simplest correct way to handle removals:
// a tag left out of the input should stop being linked to this recipe.
async function setRecipeTags(recipeId: string, tagsInput: FormDataEntryValue | null) {
  const names = Array.from(
    new Set(
      str(tagsInput)
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  await db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
  if (names.length === 0) return;

  // Find-or-create each tag, then link it. One recipe has only a handful of
  // tags, so a few small queries here stays simple and readable; this would
  // be worth batching into fewer round trips if that ever stopped being true.
  for (const name of names) {
    const [tag] = await db
      .insert(tags)
      .values({ name })
      .onConflictDoNothing({ target: tags.name })
      .returning();

    const tagId = tag?.id ?? (await db.select().from(tags).where(eq(tags.name, name)))[0]?.id;
    if (!tagId) continue;

    await db.insert(recipeTags).values({ recipeId, tagId }).onConflictDoNothing();
  }
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

  await setRecipeTags(created.id, formData.get("tags"));

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

  await setRecipeTags(id, formData.get("tags"));

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

// Called directly from a Client Component's onClick, not from a <form>. No
// redirect: the user stays exactly where they are, so this only revalidates.
export async function toggleWantToMake(id: string, next: boolean) {
  await db.update(recipes).set({ wantToMake: next }).where(eq(recipes.id, id));

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
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

  // redirect() throws internally, so it must run outside any try/catch.
  // Catching it here would swallow the redirect instead of performing it.
  redirect(`/recipes/new?${params.toString()}`);
}
