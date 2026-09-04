# Build log

Thin per-day record of what got built and the concept it was there to teach. Choices and
their reasoning live in [DECISIONS.md](./DECISIONS.md). Setup detail is in
[WALKTHROUGH.md](./WALKTHROUGH.md).

---

## Days 1-2: scaffold and deploy

- `create-next-app` (Next 16, App Router, TS, Tailwind). Drizzle wired: `db/schema.ts`
  (recipe, tag, recipe_tag), `db/index.ts` (neon-http driver), first migration generated
  and applied to Neon.
- First commit, pushed to GitHub, deployed to Vercel with `DATABASE_URL` set.
- Fixed a hydration warning from a browser extension with `suppressHydrationWarning` on
  `<body>`.
- **Taught:** the deploy loop, migrations, hydration basics.

## Day 3: the read path (Server Components)

- `db/seed.mts` and `npm run db:seed`: 5 recipes, 5 tags. First look at Drizzle inserts.
- `app/page.tsx`: list of recipes, newest first. An `async` Server Component querying
  Drizzle directly. No `fetch`, no `/api` route, no loading state.
- `app/recipes/[id]/page.tsx`: dynamic route, `await params`, `generateMetadata`,
  `notFound()` for a missing or malformed id.
- `export const dynamic = "force-dynamic"` on both for now, real caching is day 5-6.
- **Taught:** RSC data fetching, why there is no spinner, dynamic routes.

## Day 5-6: the write path (Server Actions)

- `app/lib/actions.ts` with `"use server"`. `createRecipe(formData)`: validates input,
  Drizzle insert, `revalidatePath("/")`, `redirect()` to the new recipe.
- `app/recipes/new/page.tsx`: plain `<form action={createRecipe}>` in a Server Component.
  Works with JS disabled. `+ Add recipe` link on the list.
- **Taught:** Server Actions, forms without an API route or client JS, `revalidatePath`.
- `updateRecipe` and `deleteRecipe` added to `app/lib/actions.ts`. Both invoked from forms via
  `.bind(null, id)`, so the recipe id travels with the action instead of a hidden input.
  `app/recipes/[id]/edit/page.tsx`: pre-filled form. Detail page got Edit/Delete controls.
  Read logic pulled out to `app/lib/data.ts` (`getRecipeById`), shared by detail and edit.
- Delete has no confirm dialog yet: that needs a Client Component, deliberately deferred to
  day 9 alongside the want-to-make toggle.
- **Taught:** passing extra arguments to a Server Action, splitting read helpers from write
  actions.
- Decided to keep `force-dynamic` everywhere rather than move to cache-plus-revalidate: it's
  the simple, hard-to-get-wrong option, and the caching layers aren't well enough understood
  yet to trust the alternative. DECISIONS entry written honestly at "still fuzzy" confidence.

## Day 7: URL capture

- `app/lib/capture.ts`: `captureFromWebUrl` fetches a page server-side and parses its
  `Recipe` JSON-LD (handles `@graph`-nested nodes, array or string `recipeInstructions`,
  and unquoted `type=application/ld+json` attributes, found in the wild on a real site).
  `captureFromInstagramUrl` calls the oEmbed endpoint for a caption and thumbnail; expected
  to fail often since Instagram restricts oEmbed access, which is exactly why it degrades
  quietly instead of erroring.
- `importFromUrl` action: fetches, then redirects to `/recipes/new` carrying whatever it
  found as query params. No DB write of its own.
- `/recipes/new` reads `searchParams` to pre-fill the existing form; shows a fallback notice
  ("paste it yourself") when nothing was found.
- Tested end to end against a real site (loveandlemons.com): title, ingredients, steps,
  notes, and image all extracted and saved correctly. Also tested the failure path (a
  nonexistent domain) to confirm the fallback message shows.
- **Taught:** `searchParams` as a page prop, server-side third-party `fetch`, a mutation
  that redirects with data instead of writing to the DB, real-world HTML being messier than
  the spec (the unquoted-attribute bug).

## Day 8: tags, filter, search

- `app/lib/actions.ts`: `setRecipeTags(recipeId, tagsInput)`, a comma-separated `tags` field
  parsed, deduped, lowercased. Delete-then-reinsert into `recipe_tag` so removing a tag from
  the input actually removes the link, not just additive. Wired into `createRecipe` and
  `updateRecipe`. Both add/edit forms got a `tags` text input.
- `app/lib/data.ts`: `getRecipeById` now uses Drizzle's relational query API (`with`) to
  pull a recipe's tags in one query. `getRecipes({ tag, q })` does a manual `LEFT JOIN` across
  recipe/recipe_tag/tag, groups rows into one-per-recipe in JS, and filters by tag after
  grouping (filtering in SQL would have dropped a matching recipe's *other* tags, since the
  join fans out to one row per tag). Search (`q`) is a real SQL `ILIKE` on the title.
  `getAllTagNames()` for the filter pill list.
- `app/page.tsx`: tag pills are `<Link>`s to `/?tag=x`, a plain GET `<form>` for search (no
  JS, the browser turns submit into `/?q=...`), both readable from `searchParams`. Detail
  page shows each recipe's tags as links back to the filtered list.
- Tested end to end: filter by tag, search by title, both combined, tag dedup/case-folding on
  create, and edit correctly removing a tag no longer in the input with zero orphaned
  `recipe_tag` rows after a delete (cascade works).
- **Taught:** the URL as the single source of truth for filter/search state, a plain HTML
  GET form as a zero-JS search box, when to reach for a manual join+group instead of the
  ORM's relational `with`.

## Day 9: the want-to-make toggle (first Client Component)

- `toggleWantToMake(id, next)` added to `app/lib/actions.ts`: updates the DB, calls
  `revalidatePath` on both affected routes, no `redirect`, since the user stays put.
- `app/components/want-to-make-toggle.tsx`: the app's one `"use client"` file.
  `useOptimistic` seeded from the server-rendered value, `useTransition` to run the Server
  Action as a transition, called directly from `onClick`, not through a `<form>`. Pattern
  copied from the current Next.js docs (`interactive-apps.md`), not improvised.
- Reused on both the list page (one instance per row) and the detail page, replacing the
  static "want to make" badge in both places.
- Verified: production build clean, SSR output correct (right initial state, right styling,
  `aria-pressed` matching the DB) on both pages. The actual click-to-optimistic-update round
  trip needs a real browser to exercise (direct Server Action calls use React's Flight wire
  protocol, not practical to hand-craft with curl the way the form-based actions were), so
  that part is manually verified rather than scripted.
- **Taught:** the one legitimate reason to leave the server-only model: needing instant
  feedback before a round trip resolves. Everything else in the app stays a Server Component.
