"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
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

// Makes a recipe's tag links match `rawNames` exactly (one hidden
// <input name="tag"> per tag in the combobox). Written as a diff, not a
// wipe-and-refill: unchanged links stay put, so the recipe is never briefly
// tagless and a save that didn't touch tags writes nothing. Round trips are
// fixed at three regardless of tag count, and the two link-table writes go
// through db.batch(), which Neon runs as a single transaction.
async function setRecipeTags(recipeId: string, rawNames: string[]) {
  const names = Array.from(
    new Set(rawNames.map((name) => name.trim().toLowerCase()).filter(Boolean)),
  );

  if (names.length === 0) {
    await db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
    return;
  }

  // One bulk upsert instead of an INSERT per tag: create the names that are new,
  // ignore the ones that already exist, then read back the ids for the whole set.
  await db
    .insert(tags)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: tags.name });

  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.name, names));
  const tagIds = rows.map((r) => r.id);

  await db.batch([
    // Drop only the links this save removed; leave the rest untouched.
    db
      .delete(recipeTags)
      .where(
        and(
          eq(recipeTags.recipeId, recipeId),
          notInArray(recipeTags.tagId, tagIds),
        ),
      ),
    // Add the links this save introduced; ON CONFLICT skips the ones already there.
    db
      .insert(recipeTags)
      .values(tagIds.map((tagId) => ({ recipeId, tagId })))
      .onConflictDoNothing(),
  ]);
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
