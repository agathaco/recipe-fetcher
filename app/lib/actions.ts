"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recipeTags, recipes, tags } from "@/db/schema";
import { AUTH_COOKIE, sha256Hex } from "@/app/lib/auth";
import { captureFromInstagramUrl, captureFromWebUrl, isInstagramUrl } from "@/app/lib/capture";

// Everything in this file runs only on the server. It is imported by forms and
// invoked over the network as a POST, so it must validate its own input.

// The shape the two big form actions hand back to `useActionState`. An empty
// object means "no error yet"; a filled `error` is shown inline by the form.
// Redirect-on-success still happens by throwing, so the happy path returns
// nothing that the form ever renders.
export type FormState = { error?: string };

const SAVE_FAILED =
  "Couldn't reach the database. Give it a moment and try again.";

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s === "" ? null : s;
}

// The ingredient / step row editors submit one field per row, all with the same
// name. Collapse each row to a single line, drop blanks, join with newlines,
// which is the shape the `text` column stores and the detail page splits back.
function linesFromRows(formData: FormData, name: string): string | null {
  const joined = formData
    .getAll(name)
    .map((v) => String(v).replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return joined === "" ? null : joined;
}

// Replaces a recipe's whole tag set with the list from the tag combobox (one
// hidden <input name="tag"> per selected tag). Delete-then-reinsert is the
// simplest correct way to handle removals: a tag left out should stop being
// linked to this recipe.
async function setRecipeTags(recipeId: string, rawNames: string[]) {
  const names = Array.from(
    new Set(rawNames.map((name) => name.trim().toLowerCase()).filter(Boolean)),
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

// Signature is (prevState, formData) so it can back a `useActionState` form.
export async function createRecipe(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = str(formData.get("title"));
  if (!title) return { error: "Give the recipe a title before saving." };

  let createdId: string;
  try {
    const [created] = await db
      .insert(recipes)
      .values({
        title,
        sourceUrl: strOrNull(formData.get("sourceUrl")),
        sourceType: strOrNull(formData.get("sourceType")) ?? "manual",
        imageUrl: strOrNull(formData.get("imageUrl")),
        ingredients: linesFromRows(formData, "ingredient"),
        steps: linesFromRows(formData, "step"),
        notes: strOrNull(formData.get("notes")),
        wantToMake: formData.get("wantToMake") === "on",
      })
      .returning();

    await setRecipeTags(created.id, formData.getAll("tag").map(String));
    createdId = created.id;
  } catch {
    return { error: SAVE_FAILED };
  }

  // Bust the cached list page so the new recipe shows up.
  revalidatePath("/");
  // Throws a control-flow exception (outside the try, so it isn't caught);
  // nothing after this runs.
  redirect(`/recipes/${createdId}`);
}

// The edit form calls this via updateRecipe.bind(null, id), so `id` arrives as
// a real argument, then the `useActionState` (prevState, formData) pair.
export async function updateRecipe(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = str(formData.get("title"));
  if (!title) return { error: "Give the recipe a title before saving." };

  try {
    await db
      .update(recipes)
      .set({
        title,
        sourceUrl: strOrNull(formData.get("sourceUrl")),
        imageUrl: strOrNull(formData.get("imageUrl")),
        ingredients: linesFromRows(formData, "ingredient"),
        steps: linesFromRows(formData, "step"),
        notes: strOrNull(formData.get("notes")),
        wantToMake: formData.get("wantToMake") === "on",
      })
      .where(eq(recipes.id, id));

    await setRecipeTags(id, formData.getAll("tag").map(String));
  } catch {
    return { error: SAVE_FAILED };
  }

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

// The login form on /login posts here. One shared password, compared against
// APP_PASSWORD. On success, set a cookie holding the password's digest; the
// proxy checks incoming requests against that same value.
export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const from = str(formData.get("from"));
  const secret = process.env.APP_PASSWORD;

  if (!secret || password !== secret) {
    redirect(`/login?error=1${from ? `&from=${encodeURIComponent(from)}` : ""}`);
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, await sha256Hex(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Only same-origin paths. "//evil.com" starts with "/" but is an external URL.
  const safeFrom = from.startsWith("/") && !from.startsWith("//") ? from : "/";
  redirect(safeFrom);
}

export async function logout() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}

// Called directly from a Client Component's onClick, not from a <form>. No
// redirect: the user stays exactly where they are, so this only revalidates.
export async function toggleWantToMake(id: string, next: boolean) {
  await db.update(recipes).set({ wantToMake: next }).where(eq(recipes.id, id));

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

// Same pattern as toggleWantToMake. 0 (or anything out of range) clears the
// rating back to null.
export async function setRating(id: string, rating: number) {
  const valid = Number.isInteger(rating) && rating >= 1 && rating <= 5;
  await db
    .update(recipes)
    .set({ rating: valid ? rating : null })
    .where(eq(recipes.id, id));

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
  const qs = params.toString();
  redirect(qs ? `/recipes/new?${qs}` : "/recipes/new");
}
