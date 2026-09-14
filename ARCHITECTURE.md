# Architecture

How this project is put together, and what Next.js is doing in it. Kept current as the build
progresses. The running list of Next.js features and where each one first appears is at the
bottom.

---

## What Next.js is for here

In this project Next.js is the **entire stack**, not just a frontend framework:

- **Router.** File-based. A file at `app/foo/page.tsx` becomes the route `/foo`. No router config.
- **Server.** There is no separate Express or API server. Pages render on the server and can
  query Postgres directly. Mutations run as server functions. Next.js is the backend.
- **Build tool.** Compiles TypeScript and JSX, splits code into what runs on the server and
  what ships to the browser, bundles the client parts.
- **Rendering model.** Components are React Server Components by default: they run on the
  server, can be `async`, and never ship JavaScript. You opt into client-side interactivity
  per component with `"use client"`.

So "learning Next.js" here means learning: the App Router, Server Components, Server Actions,
the server/client boundary, and the caching model.

## What the app does

- **Capture a recipe** three ways: paste a web URL (parses the page's `Recipe` JSON-LD),
  paste an Instagram URL (oEmbed caption + thumbnail), or type it in by hand. Any capture
  that fails falls back to an empty form.
- **A recipe** has: title, source URL and type, an image, ingredients and steps (freeform
  text, one per line), notes, tags, a "want to make" flag, and a 1-5 rating.
- **List view** at `/`: a flat card grid, filter by tag, live search by title, sort by date
  added / name / rating. Filter, search, and sort state live entirely in the URL.
- **Detail, edit, delete** for each recipe. Detail page shows a prep/cook/oven-temp stat
  strip (when any are set), a source link labelled with the site's hostname, lets you cross
  ingredients and steps off as you cook (checked state lives in `localStorage`, not the DB,
  it's cooking-session state, not recipe data), and a photo gallery you can drag-and-drop
  more images into (uploaded to Vercel Blob, separate from the one pasted-URL cover image
  shown on cards).
- **"Want to make" toggle** (detail page) and a **1-5 star rating** (cards + detail): both
  optimistic, instant. The toggle isn't shown on the list cards themselves right now, that
  surface is being redesigned (see LOG).
- **One-user auth**: a shared password checked in `proxy.ts` before every request.
- **Deployed** on Vercel with Postgres on Neon.

## Data model

Five tables, deliberately flat (`db/schema.ts`):

- **`recipe`**: one row per recipe. `ingredients` and `steps` are plain `text` columns, one
  item per line, *not* their own tables. Normalising the ingredient graph (units,
  substitutions) is a real problem and explicitly out of scope here. `want_to_make` (bool)
  and `rating` (nullable int) are added as the app grew. `prep_time` / `cook_time` /
  `oven_temp` are also plain nullable `text`, same call as ingredients/steps: "20 min" and
  "180C fan" need to just work, parsing/normalising units is project 2's problem.
- **`tag`**: one row per tag name, unique. A tag exists once and is pointed at, so renaming
  or listing all tags is a single-row operation.
- **`recipe_tag`**: the join table. Each row is one `(recipe_id, tag_id)` pairing, composite
  primary key, both foreign keys `on delete cascade`. This many-to-many is the one modelling
  concept the project is here to practice: a recipe has many tags, a tag applies to many
  recipes.
- **`session`**: one row per signed-in device. `id` is `SHA-256(token)`, never the raw token;
  `expiresAt` is checked, and the row deleted, on the next request that presents an expired
  cookie (lazy sweep, no scheduled job). Not part of the recipe data model, it exists so auth
  has somewhere server-side to revoke from; see "Signing in" below.
- **`recipe_image`**: a recipe's photo gallery, one-to-many, `recipe_id` FK `on delete
  cascade`, `url` pointing at a Vercel Blob object. Deliberately separate from
  `recipe.image_url` (the single pasted/captured cover shown on cards): uploading a gallery
  photo never changes the card thumbnail, that stays an explicit choice via the Image URL
  field.

`id`s are `uuid` with a database default, except `session.id`, which is a hash string.
`created_at` / `updated_at` are `timestamptz`; `updated_at` is bumped by Drizzle on every
`update()`, no DB trigger.

## Request lifecycles

### Loading a page (`/`)

1. Request hits Next.js (a serverless function on Vercel).
2. `app/layout.tsx` renders the `<html>`/`<body>` shell.
3. `app/page.tsx` runs **on the server**. It is `async`, so Next waits for its `await db.select()...`
   Drizzle query to finish.
4. The query runs against Neon. Rows come back.
5. Next renders the component to HTML with the recipes already in it and streams it to the browser.
6. The browser paints a complete page. Minimal JS loads (just what Next needs for client-side
   navigation between links). No data-fetching JS, because there is nothing left to fetch.

### Submitting the add form (`/recipes/new`)

1. `app/recipes/new/page.tsx` renders a plain `<form action={createRecipe}>` on the server.
2. `createRecipe` is a Server Action (`"use server"` in `app/lib/actions.ts`). Next turns the
   form into one that POSTs to itself.
3. On submit, the browser POSTs the form data. Next runs `createRecipe` **on the server**.
4. The action validates input, does a Drizzle `insert`, writes the tags via `setRecipeTags`,
   calls `revalidatePath("/")`, then `redirect()`.
5. Next sends back a redirect. The browser lands on the new recipe's page, which renders
   fresh via lifecycle 1.
6. This works with JavaScript disabled, because it is a real form POST.

### Importing from a URL (`/recipes/new`, the "Fetch" box)

1. The small URL form posts to the `importFromUrl` Server Action (separate from the save
   form: importing and saving are different mutations).
2. On the server, `importFromUrl` picks a parser by hostname and calls `captureFromWebUrl` or
   `captureFromInstagramUrl` in `app/lib/capture.ts`. Those do a server-side `fetch` of the
   third-party page or API. Any failure returns `null`.
3. It builds a query string from whatever fields came back and `redirect()`s to
   `/recipes/new?title=...&ingredients=...`.
4. `/recipes/new` re-renders, reads those `searchParams`, and uses them as the form's
   `defaultValue`s. If nothing was found, the form is just empty with a notice.
5. From here the user reviews and submits the normal save form (lifecycle above).

### Signing in

1. Any request without a session `proxy.ts` recognizes as valid hits it first, which
   `redirect`s to `/login?from=<the path they wanted>`.
2. `/login` shows a password form posting to the `login` Server Action.
3. `login` compares the submitted password to `APP_PASSWORD`. Wrong: redirect back to
   `/login?error=1`. Right: generate a random token, insert a `session` row keyed by
   `SHA-256(token)` with a 30-day `expiresAt`, and set an httpOnly cookie holding the raw
   token, then `redirect()` to `from`.
4. Every later request carries that cookie; `proxy.ts` hashes it and looks the row up in
   `session`, rejecting if the row is missing or `expiresAt` has passed (deleting it in the
   latter case). "Sign out" runs the `logout` action, which deletes this device's `session`
   row by hash, then clears the cookie, so only this device is signed out.

## File map

| File | What it is | Next.js feature |
|---|---|---|
| `app/layout.tsx` | Root layout, wraps every page | Layouts, `metadata` |
| `app/page.tsx` | Recipe list at `/` | Server Component, direct DB query, `dynamic` |
| `app/recipes/[id]/page.tsx` | One recipe at `/recipes/:id` | Dynamic route, `await params`, `generateMetadata`, `notFound()` |
| `app/recipes/new/page.tsx` | Add form at `/recipes/new` | Server Component form, `<form action={}>` |
| `app/recipes/[id]/edit/page.tsx` | Edit form at `/recipes/:id/edit` | pre-filled form, `updateRecipe.bind(null, id)` |
| `app/login/page.tsx` | Password form at `/login` | posts to the `login` Server Action |
| `app/lib/actions.ts` | every mutation: `createRecipe`, `updateRecipe`, `deleteRecipe`, `toggleWantToMake`, `setRating`, `importFromUrl`, `login`, `logout` | Server Actions (`"use server"`), `.bind()`, `revalidatePath`, `redirect`, `cookies()`; `createRecipe`/`updateRecipe` return a `FormState` for `useActionState` |
| `app/error.tsx` | route-level error boundary | `"use client"`, `error` + `reset` props |
| `app/global-error.tsx` | root-layout error boundary | `"use client"`, renders its own `<html>`/`<body>` |
| `app/lib/data.ts` | `getRecipeById`, `getRecipes`, `getAllTagNames` | server-side read helpers; manual join + group-in-JS for the filterable list (sorted in SQL before grouping), Drizzle's relational `with` for the single-recipe read |
| `app/lib/capture.ts` | `captureFromWebUrl`, `captureFromInstagramUrl` | server-side `fetch` of a third-party page/API, never runs in the browser |
| `app/lib/auth.ts` | `AUTH_COOKIE`, `sha256Hex`, `randomToken`, `sessionId` | Web-Crypto only, shared by the Edge proxy and the Node login/logout actions |
| `app/components/want-to-make-toggle.tsx` | the toggle button (detail page only, for now) | `"use client"`, `useOptimistic` |
| `app/components/search-box.tsx` | the live search input | `"use client"`, debounced `router.replace` |
| `app/components/sort-select.tsx` | the list page's sort dropdown | `"use client"`, `useSearchParams` + `router.replace`, plain `<select>` inside the same GET form for the no-JS path |
| `app/components/rating-stars.tsx` | the detail-page star rating | `"use client"`, optimistic |
| `components/star-row.tsx` | read-only stars on list cards | plain component |
| `app/components/tag-input.tsx` | the recipe form tag combobox | `"use client"` |
| `app/components/delete-recipe-button.tsx` | the detail-page Delete button | `"use client"`, `confirm()` + toast on failure |
| `components/recipe-form.tsx` | the `<form>` shell around `RecipeFields` for add and edit | `"use client"`, `useActionState`, `useFormStatus` |
| `components/recipe-checklist.tsx` | cross off ingredients/steps on the detail page | `"use client"`, reads/writes `localStorage` after mount (not the DB), guards against a hydration mismatch by only setting state in an effect |
| `app/components/photo-gallery.tsx` | the detail-page photo grid + drop zone | `"use client"`, `@vercel/blob/client`'s `upload()`, drag-and-drop + native file input |
| `app/api/upload/route.ts` | mints upload tokens for `@vercel/blob/client`, one per file | Route Handler, not a Server Action, `@vercel/blob`'s client-upload contract needs a plain HTTP endpoint the browser SDK calls directly |
| `components/tag-pill.tsx` | colour-per-tag pill + `tagColorClasses` helper | plain component |
| `components/ui/sonner.tsx` | the toast outlet, mounted once in the layout | `"use client"` |
| `proxy.ts` | the auth gate | runs before every matched request (Edge runtime); looks the session up in `session` on every request, redirects to `/login` if missing, unknown, or expired |
| `app/globals.css` | Tailwind entry + shadcn theme tokens (fuchsia-purple primary, `.text-brand` gradient, `--font-heading` = Bricolage Grotesque) | (not Next specific) |
| `components/ui/` | shadcn/ui components (button, input, card, badge, checkbox, ...) | copied into the repo, owned locally, built on Base UI |
| `components/recipe-fields.tsx` | the card sections shared by the add and edit forms | plain component |
| `components/rows-editor.tsx` | add/remove row list for ingredients and steps | `"use client"`, submits repeated same-named inputs |
| `db/index.ts` | Drizzle client | server-only module, imported by Server Components/Actions |
| `db/schema.ts` | Table definitions and relations | (Drizzle, not Next) |
| `db/seed.mts` | Dev seed script | plain script, run with `tsx`, not part of the app |
| `next.config.ts` | Next config, currently empty | config |

## The server/client boundary

Almost everything runs on the server. A handful of Client Components are the exceptions,
each because it needs real browser state or has to react to a failure.

- The database client, the connection string, and all query and mutation logic stay
  server-side and never reach the browser bundle.
- `app/components/want-to-make-toggle.tsx` (`useOptimistic` + `useTransition`): flips
  instantly, before the round trip. Detail page only right now, see LOG for why it came off
  the list cards.
- `app/components/search-box.tsx` (`useSearchParams` + `useRouter` + a debounce): filters
  live on each keystroke. It still writes the query to the URL and the server still does the
  filtering, so it is a thin client shell over the same URL-as-state model.
- `app/components/sort-select.tsx` (`useSearchParams` + `useRouter`, no debounce needed for a
  discrete choice): same URL-as-state model as search, sits inside the same GET form so a
  no-JS submit carries `sort` along with `q` and `tag`.
- `components/rows-editor.tsx`: add / remove rows in the ingredient and step editors. Each
  row is a same-named input; the Server Action reads them with `formData.getAll()`. Storage
  stays newline-joined text.
- `app/components/rating-stars.tsx`: 1-5 star rating on the detail page, hover preview plus
  an optimistic update, same shape as the want-to-make toggle.
- `app/components/tag-input.tsx`: the recipe form tag combobox (filter, create, removable
  pills). Selected tags become hidden `<input name="tag">`s the Server Action reads.
- `components/recipe-form.tsx`: the `<form>` around the shared fields. `useActionState`
  turns a failed save into an inline message with the form still filled in; `useFormStatus`
  drives the "Saving..." button state.
- `app/components/delete-recipe-button.tsx`: needs a `confirm()` step and a place to show
  "that didn't work", so the bound `deleteRecipe` action is called from a client `onClick`
  and a thrown error becomes a toast.
- `components/recipe-checklist.tsx`: cooking progress (which lines are crossed off) is
  browser-only state read from `localStorage` after mount, deliberately never sent to the
  server or stored in the DB.
- `app/components/photo-gallery.tsx`: drag-and-drop needs real DOM events
  (`onDragOver`/`onDrop`), and each upload calls `@vercel/blob/client`'s `upload()` directly
  from the browser (straight to Blob storage, bypassing the server entirely for the file
  bytes themselves), then `addRecipeImage` to record the resulting URL.

## Error handling

Three layers, matching the three ways things fail:

- **Unexpected render throws** (DB outage while a page loads): `app/error.tsx` catches them
  and offers "Try again" (`reset`) or a link home. `app/global-error.tsx` is the same idea
  one level up, for the root layout. `getRecipeById` deliberately does *not* swallow DB
  errors as "not found" any more; only a syntactically invalid uuid is a 404.
- **Form save failures** (validation or a write that fails): `createRecipe` / `updateRecipe`
  return `{ error }` instead of throwing, and `useActionState` in `recipe-form.tsx` renders
  it inline without losing what was typed.
- **Optimistic-action failures** (`toggleWantToMake`, `setRating`, delete): the client catch
  shows a `sonner` toast; the optimistic UI value reverts by itself.

## What runs where

| Concern | Where | How |
|---|---|---|
| Routing | Server | file structure under `app/` |
| Reading data | Server | Server Component calls Drizzle directly |
| Writing data | Server | Server Action called from a form |
| HTML generation | Server | RSC render |
| Navigation between pages | Client | Next's `<Link>` does client-side transitions |
| Interactivity | Client | the ten `"use client"` components (toggle, search, sort, ratings, tag combobox, row editors, the form shell, delete confirm, the ingredient/step checklist, the photo gallery) |

## Caching

`app/layout.tsx` sets `export const dynamic = "force-dynamic"` once, which cascades to every
route: no route-level caching, every request re-renders from the database. This was a
deliberate choice (see DECISIONS): the alternative, letting pages cache by default and
busting them with `revalidatePath` after each mutation, is faster but relies on never
missing a `revalidatePath` call. The mutations do still call `revalidatePath` on the routes
they affect, so switching to the cached model later is mostly a matter of removing that one
export.

## How it maps to Vercel

Each dynamic route becomes a serverless function. A request spins up a short-lived function,
which renders the page (querying Neon over HTTP), returns the HTML, and is torn down.
`proxy.ts` runs as an Edge function ahead of all of that, and now queries Neon itself (one
`session` lookup per request, via the same HTTP-based driver, which works from the Edge
runtime) rather than the pure in-memory hash comparison it used to be. There are no static
routes left: everything reads the DB, cookies, or `searchParams`, so all routes render on
demand.

Three env vars are needed in Vercel: `DATABASE_URL` (Neon), `APP_PASSWORD` (the auth gate;
if unset, the gate is disabled and the app is public), and `BLOB_READ_WRITE_TOKEN` (Vercel
Blob, for photo uploads; Vercel adds this one automatically once a Blob store is attached to
the project, the other two are set by hand).

**Migrations.** Vercel builds run whatever `package.json` names `vercel-build` instead of the
default `build` script, if that script exists. This project's `vercel-build` runs
`db:migrate` first, but only when `$VERCEL_ENV = production` (Vercel sets that automatically;
it's `preview` on PR/branch deploys), then `next build`. Preview deploys never touch the
database, since there's one shared Neon instance, not per-branch databases. If the migration
fails, the build fails and the bad deploy never goes live. Before this, migrations were a
manual `npm run db:migrate` run by hand against the shared connection string; see DECISIONS.

---

## Next.js features, as they were introduced

| Day | Feature | First appears in | What it does |
|---|---|---|---|
| 1-2 | App Router project | whole `app/` dir | file-based routing, `create-next-app` |
| 1-2 | Root layout | `app/layout.tsx` | the shared `<html>`/`<body>` shell |
| 1-2 | `metadata` export | `app/layout.tsx` | static `<title>` and `<meta>` |
| UI pass | `app/icon.svg` file convention | `app/icon.svg` | drop an SVG in and Next injects the favicon `<link>`, no config |
| 3 | Server Component data fetching | `app/page.tsx` | `async` component queries the DB on the server, no `/api` route |
| 3 | Route segment config | `app/layout.tsx` | `export const dynamic = "force-dynamic"`, set once on the root layout, cascades to every route |
| 3 | Dynamic route | `app/recipes/[id]/` | `[id]` segment, `params` is a Promise |
| 3 | `generateMetadata` | `app/recipes/[id]/page.tsx` | per-recipe `<title>` |
| 3 | `notFound()` | `app/recipes/[id]/page.tsx` | render the 404 UI for a missing recipe |
| 3 | `<Link>` | `app/page.tsx` | client-side navigation between routes |
| 5-6 | Server Action | `app/lib/actions.ts` | `"use server"` function invoked from a form |
| 5-6 | `<form action={fn}>` | `app/recipes/new/page.tsx` | form wired to a Server Action, works without JS |
| 5-6 | `revalidatePath` | `app/lib/actions.ts` | mark a cached route stale after a write |
| 5-6 | `redirect` | `app/lib/actions.ts` | navigate after a mutation |
| 5-6 | `title.template` | `app/layout.tsx` | child pages set just their own title; the layout wraps it, e.g. "Add a recipe · Recipes" |
| 5-6 | Bound Server Action | `updateRecipe`/`deleteRecipe` in `app/lib/actions.ts` | `action.bind(null, id)` passes an id into a Server Action invoked from a form, with no hidden `id` input needed |
| 7 | `searchParams` page prop | `app/recipes/new/page.tsx` | reads query params as pre-fill data, a Promise like `params` |
| 7 | Server-side `fetch` of a third party | `app/lib/capture.ts` | runs only on the server; the site being scraped never sees the user's browser, and no API key or fetch logic reaches the client bundle |
| 7 | Mutation-that-redirects-with-data | `importFromUrl` in `app/lib/actions.ts` | a Server Action that does no DB write, just carries results forward via a redirect's query string instead of persisting a draft |
| 8 | `searchParams` as filter/search state | `app/page.tsx` | `?tag=` and `?q=` read directly from the URL, no client state at all |
| 8 | Plain GET `<form>` | `app/page.tsx` search box | no `action`, no JS: the browser itself turns a submit into a navigation to `/?q=...` |
| 8 | `<Link>` as the filter UI | `app/page.tsx`, `app/recipes/[id]/page.tsx` | tag pills are just links to `/?tag=x`; clicking one is a normal navigation, not a click handler |
| 9 | `"use client"` | `app/components/want-to-make-toggle.tsx` | the app's first and only client-rendered component; ships JS, can use hooks and event handlers |
| 9 | `useOptimistic` + `useTransition` | same file | flips the button on the current frame, before the Server Action's network round trip resolves; reverts to the real value once `revalidatePath` produces a fresh server render |
| 9 | Server Action called directly (no `<form>`) | `toggleWantToMake` invoked from `onClick` | a Server Action isn't only for forms; a Client Component can call one like any async function, as long as it's wrapped in a transition |
| UI pass | `useSearchParams` + `useRouter().replace` | `app/components/search-box.tsx` | a Client Component reads and writes the URL query string; `replace` keeps keystrokes out of history, `{ scroll: false }` stops the page jumping |
| 10 | `proxy.ts` (was `middleware.ts` pre-16) | project root | one file, runs before every matched request; `export function proxy` + a `config.matcher` regex |
| 10 | Edge runtime constraints | `proxy.ts` + `app/lib/auth.ts` | proxy code can't use Node APIs, so the shared auth helper uses only Web Crypto |
| 10 | `cookies()` from `next/headers` | `login` / `logout` in `app/lib/actions.ts` | read and set cookies inside a Server Action; setting one re-renders the current route |
| errors | `error.tsx` | `app/error.tsx` | route-level error boundary; Next swaps it in when a Server Component render (or a data helper it calls) throws. Must be `"use client"`, gets `error` + `reset` props |
| errors | `global-error.tsx` | `app/global-error.tsx` | catches throws in the root layout itself; replaces the whole document so it renders its own `<html>`/`<body>` |
| errors | `useActionState` | `components/recipe-form.tsx` | wraps a Server Action so it can return `{ error }` instead of throwing; the form stays mounted and keeps its values, the message renders inline |
| errors | `useFormStatus` | `components/recipe-form.tsx` (`SubmitButton`) | reads the pending state of the enclosing `<form>` to disable the button and show "Saving..." |
| errors | expected vs unexpected errors | `app/lib/actions.ts`, `app/lib/data.ts` | handled cases (bad input, save failed) return a message; genuinely unexpected throws are left to reach `error.tsx`. `getRecipeById` only treats a malformed uuid as "not found", not a DB outage |
| errors | `sonner` toast | `app/layout.tsx` `<Toaster>`, `rating-stars` / `want-to-make-toggle` / `delete-recipe-button` | client-side failures of an optimistic action surface as a toast; the optimistic value reverts on its own |
| redesign | 8th `"use client"` component | `app/components/sort-select.tsx` | same `useSearchParams`/`router.replace` shape as search, this time for a discrete `<select>` instead of a debounced text input |
| redesign | SQL-side sort with `nullsLast` via raw `sql` | `app/lib/data.ts` `orderByFor` | `asc()`/`desc()` don't take a nulls option on a plain column (that's index-definition-only API); a raw `` sql`...DESC NULLS LAST` `` fragment does, and slots into `.orderBy()` like any other `SQL` value |
| detail-page | First real Route Handler | `app/api/upload/route.ts` | every prior mutation was a Server Action because the caller was always this app's own UI; here the caller is `@vercel/blob/client`'s browser SDK, which needs a plain HTTP endpoint it controls the request/response shape of, exactly the "not my own frontend" case Q9 names as when you *do* need one |
| detail-page | Client-direct upload, server never touches file bytes | `app/components/photo-gallery.tsx` + `app/api/upload/route.ts` | the Route Handler only mints a short-lived token (`handleUpload`); the actual file goes browser -> Blob storage directly, so there's no Server Action body-size limit to hit and no file streaming through a serverless function |
