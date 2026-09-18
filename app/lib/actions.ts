"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { del } from "@vercel/blob";

import { db } from "@/db";
import {
  recipeImages,
  recipeIngredients,
  recipeTags,
  recipes,
  sessions,
  tags,
  users,
} from "@/db/schema";
import {
  AUTH_COOKIE,
  SESSION_TTL_MS,
  hashPassword,
  randomToken,
  sessionId,
  verifyPassword,
} from "@/app/lib/auth";
import { requireCurrentUser } from "@/app/lib/session";
import { captureFromWebUrl } from "@/app/lib/capture";
import { parseIngredientLine } from "@/app/lib/ingredients";

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
//
// Tags are per-user (see db/schema.ts): the upsert and the id lookup are both
// scoped by ownerId, so two people can each have their own "vegan" tag and
// never see or collide with the other's.
async function setRecipeTags(recipeId: string, ownerId: string, rawNames: string[]) {
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
    .values(names.map((name) => ({ ownerId, name })))
    .onConflictDoNothing({ target: [tags.ownerId, tags.name] });

  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.ownerId, ownerId), inArray(tags.name, names)));
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

// Structured ingredients, alongside `recipe.ingredients`'s text blob, not
// replacing it (see DECISIONS, and db/schema.ts's comment on the table).
// Unlike setRecipeTags, these rows are entirely private to one recipe, no
// cross-recipe sharing to preserve, so a plain delete-then-reinsert is
// correct and simpler than a diff-based upsert.
async function setRecipeIngredients(recipeId: string, rawRows: string[]) {
  const rows = rawRows
    .map((v) => v.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  if (rows.length === 0) return;

  await db.insert(recipeIngredients).values(
    rows.map((rawText, position) => ({
      recipeId,
      position,
      rawText,
      ...parseIngredientLine(rawText),
    })),
  );
}

// Signature is (prevState, formData) so it can back a `useActionState` form.
export async function createRecipe(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = str(formData.get("title"));
  if (!title) return { error: "Give the recipe a title before saving." };

  const user = await requireCurrentUser();

  let createdId: string;
  try {
    const [created] = await db
      .insert(recipes)
      .values({
        ownerId: user.id,
        title,
        sourceUrl: strOrNull(formData.get("sourceUrl")),
        sourceType: strOrNull(formData.get("sourceType")) ?? "manual",
        imageUrl: strOrNull(formData.get("imageUrl")),
        ingredients: linesFromRows(formData, "ingredient"),
        steps: linesFromRows(formData, "step"),
        notes: strOrNull(formData.get("notes")),
        prepTime: strOrNull(formData.get("prepTime")),
        cookTime: strOrNull(formData.get("cookTime")),
        ovenTemp: strOrNull(formData.get("ovenTemp")),
        wantToMake: formData.get("wantToMake") === "on",
      })
      .returning();

    await setRecipeTags(created.id, user.id, formData.getAll("tag").map(String));
    await setRecipeIngredients(created.id, formData.getAll("ingredient").map(String));
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

  const user = await requireCurrentUser();

  // Ownership check first, before anything else, same reasoning as
  // deleteRecipe's pre-check: setRecipeTags/setRecipeIngredients below only
  // scope their writes by recipeId, not ownerId (tags rows are already
  // ownerId-scoped themselves, but the recipeTags/recipe_ingredient join
  // rows they write aren't). Without this check up front, a direct POST
  // with someone else's recipe id would correctly update zero rows in
  // `recipes` (the WHERE below still filters by ownerId too, defense in
  // depth) but would *not* have been stopped from still linking your own
  // tags or ingredient rows onto their recipe.
  const [owned] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, user.id)))
    .limit(1);
  if (!owned) redirect("/");

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
        prepTime: strOrNull(formData.get("prepTime")),
        cookTime: strOrNull(formData.get("cookTime")),
        ovenTemp: strOrNull(formData.get("ovenTemp")),
        wantToMake: formData.get("wantToMake") === "on",
      })
      .where(and(eq(recipes.id, id), eq(recipes.ownerId, user.id)));

    await setRecipeTags(id, user.id, formData.getAll("tag").map(String));
    await setRecipeIngredients(id, formData.getAll("ingredient").map(String));
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
  const user = await requireCurrentUser();

  // Ownership check first, before touching Blob storage: without this, an
  // id belonging to someone else's recipe would still match rows in the
  // images SELECT below (recipe_image has no ownerId of its own, only via
  // its parent recipe), and those blobs would get deleted for real even
  // though the recipes DELETE at the end would then match nothing. Checking
  // ownership up front means every following step only ever touches your
  // own data.
  const [owned] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, user.id)))
    .limit(1);
  if (!owned) redirect("/");

  // recipe_image rows cascade-delete with the recipe (FK on delete cascade),
  // but that only removes the DB rows, not the actual files sitting in Blob
  // storage. Without this, every deleted recipe's photos leak forever with no
  // code path left that could ever find them again to clean up.
  const images = await db
    .select({ url: recipeImages.url })
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, id));
  if (images.length > 0) {
    // Best-effort: one failed blob delete shouldn't block deleting the
    // recipe itself, an orphaned blob costs a few KB, a recipe you can't
    // delete at all is worse.
    await Promise.allSettled(images.map((img) => del(img.url)));
  }

  await db.delete(recipes).where(eq(recipes.id, id));

  revalidatePath("/");
  redirect("/");
}

// Called directly from PhotoGallery's onClick/onChange after the browser has
// already uploaded the file straight to Blob storage (a client upload, see
// app/api/upload/route.ts): this just records the resulting URL. Errors
// propagate; the client catches them and shows a toast, same pattern as
// toggleWantToMake/setRating.
export async function addRecipeImage(recipeId: string, url: string) {
  const user = await requireCurrentUser();

  const [owned] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, user.id)))
    .limit(1);
  if (!owned) throw new Error("Not found");

  await db.insert(recipeImages).values({ recipeId, url });
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipeImage(imageId: string, recipeId: string, url: string) {
  const user = await requireCurrentUser();

  const [owned] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, user.id)))
    .limit(1);
  if (!owned) throw new Error("Not found");

  // DB row first, then the blob: if the blob delete fails, the row (the only
  // thing the gallery actually reads) is already gone, so the photo still
  // disappears correctly and the leftover blob is just harmless orphaned
  // storage. The reverse order was worse: a blob delete that succeeds right
  // before a DB failure would leave a row pointing at a permanently-404 URL,
  // a broken image with nothing left to retry the cleanup.
  await db.delete(recipeImages).where(eq(recipeImages.id, imageId));
  revalidatePath(`/recipes/${recipeId}`);
  await del(url).catch(() => {
    // Swallowed on purpose, see above: the user-visible part already succeeded.
  });
}

// Shared by login and signup: issue a session for `userId` and land on `from`
// (or "/" if there wasn't one, or it wasn't a safe same-origin path).
async function startSession(userId: string, from: string): Promise<never> {
  const token = randomToken();
  await db.insert(sessions).values({
    id: await sessionId(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  // Only same-origin paths. "//evil.com" starts with "/" but is an external URL.
  const safeFrom = from.startsWith("/") && !from.startsWith("//") ? from : "/";
  redirect(safeFrom);
}

// The login form on /login posts here. Real per-account credentials now
// (see DECISIONS: growing past the single-shared-password model): look the
// user up by email, verify the password against their stored bcrypt hash.
// On success, issue a random session token: the raw token goes in the
// cookie, only its hash is stored server-side in `session`. The proxy looks
// the hashed cookie value up on every request, so a session can be revoked
// (logout, or an expiry sweep) without touching any other session.
export async function login(formData: FormData) {
  const email = str(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const from = str(formData.get("from"));

  // Honest, known gap: an unknown email returns faster than a known one with
  // a wrong password, since bcrypt.compare only runs in the second case.
  // A real fix compares against a precomputed dummy hash either way; skipped
  // for now rather than hand-typing a bcrypt hash literal that could be
  // malformed and throw, same size of tradeoff as the login-rate-limiting
  // gap already documented in DECISIONS.
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    // Carry the typed email back through the redirect, same as `from`, so
    // the form doesn't come back empty, only the password needs retyping.
    const qs = new URLSearchParams({ error: "1" });
    if (from) qs.set("from", from);
    if (email) qs.set("email", email);
    redirect(`/login?${qs}`);
  }

  await startSession(user.id, from);
}

// The signup form on /signup posts here. Validates the email is unique, hashes
// the password (never stored or logged in plain text, even for the moment
// between form submit and hash), creates the account, then signs them
// straight in, same session-issuing code login uses.
export async function signup(formData: FormData) {
  const email = str(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    redirect(`/signup?error=${encodeURIComponent("Enter a valid email.")}`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();

  await startSession(user.id, "/");
}

// Deletes this device's session row, so only this cookie stops working.
// Other devices signed into the same account are unaffected.
export async function logout() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, await sessionId(token)));
  }
  store.delete(AUTH_COOKIE);
  redirect("/login");
}

// Called directly from a Client Component's onClick, not from a <form>. No
// redirect: the user stays exactly where they are, so this only revalidates.
export async function toggleWantToMake(id: string, next: boolean) {
  const user = await requireCurrentUser();
  await db
    .update(recipes)
    .set({ wantToMake: next })
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, user.id)));

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

// Same pattern as toggleWantToMake. 0 (or anything out of range) clears the
// rating back to null.
export async function setRating(id: string, rating: number) {
  const user = await requireCurrentUser();
  const valid = Number.isInteger(rating) && rating >= 1 && rating <= 5;
  await db
    .update(recipes)
    .set({ rating: valid ? rating : null })
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, user.id)));

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

// The "paste a URL" mini-form on the add-recipe page. This never writes to
// the database itself: it fetches, tries to extract a recipe, and hands
// whatever it found to the real add-recipe form via the URL, as searchParams.
// If nothing was found, every field is simply absent and the form is empty,
// the "paste it yourself" rung of the fallback ladder. No ownership check
// needed, it doesn't touch any specific recipe, proxy.ts already guarantees
// a signed-in user reached this at all.
export async function importFromUrl(formData: FormData) {
  const url = str(formData.get("importUrl"));
  const params = new URLSearchParams();

  if (url) {
    const captured = await captureFromWebUrl(url);

    params.set("sourceUrl", url);
    params.set("sourceType", "web");
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
