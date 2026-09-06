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
  text, one per line), notes, tags, and a "want to make" flag.
- **List view** at `/`: all recipes newest first, filter by tag, search by title. Filter and
  search state live entirely in the URL.
- **Detail, edit, delete** for each recipe.
- **"Want to make" toggle**: flips instantly (optimistic UI), on both the list and detail.
- **One-user auth**: a shared password checked in `proxy.ts` before every request.
- **Deployed** on Vercel with Postgres on Neon.

## Data model

Three tables, deliberately flat (`db/schema.ts`):

- **`recipe`**: one row per recipe. `ingredients` and `steps` are plain `text` columns, one
  item per line, *not* their own tables. Normalising the ingredient graph (units,
  substitutions) is a real problem and explicitly out of scope here.
- **`tag`**: one row per tag name, unique. A tag exists once and is pointed at, so renaming
  or listing all tags is a single-row operation.
- **`recipe_tag`**: the join table. Each row is one `(recipe_id, tag_id)` pairing, composite
  primary key, both foreign keys `on delete cascade`. This many-to-many is the one modelling
  concept the project is here to practice: a recipe has many tags, a tag applies to many
  recipes.

`id`s are `uuid` with a database default. `created_at` / `updated_at` are `timestamptz`;
`updated_at` is bumped by Drizzle on every `update()`, no DB trigger.

## Request lifecycles

### Loading a page (`/`)

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

1. Any request without a valid `rf_auth` cookie hits `proxy.ts` first, which `redirect`s to
   `/login?from=<the path they wanted>`.
2. `/login` shows a password form posting to the `login` Server Action.
3. `login` compares the submitted password to `APP_PASSWORD`. Wrong: redirect back to
   `/login?error=1`. Right: set an httpOnly cookie whose value is `SHA-256(APP_PASSWORD)`,
   then `redirect()` to `from`.
4. Every later request carries that cookie; `proxy.ts` compares it to the same digest and
   lets it through. "Sign out" runs the `logout` action, which deletes the cookie.

## File map

| File | What it is | Next.js feature |
|---|---|---|
| `app/layout.tsx` | Root layout, wraps every page | Layouts, `metadata` |
| `app/page.tsx` | Recipe list at `/` | Server Component, direct DB query, `dynamic` |
| `app/recipes/[id]/page.tsx` | One recipe at `/recipes/:id` | Dynamic route, `await params`, `generateMetadata`, `notFound()` |
| `app/recipes/new/page.tsx` | Add form at `/recipes/new` | Server Component form, `<form action={}>` |
| `app/recipes/[id]/edit/page.tsx` | Edit form at `/recipes/:id/edit` | pre-filled form, `updateRecipe.bind(null, id)` |
| `app/login/page.tsx` | Password form at `/login` | posts to the `login` Server Action |
| `app/lib/actions.ts` | every mutation: `createRecipe`, `updateRecipe`, `deleteRecipe`, `toggleWantToMake`, `importFromUrl`, `login`, `logout` | Server Actions (`"use server"`), `.bind()`, `revalidatePath`, `redirect`, `cookies()` |
| `app/lib/data.ts` | `getRecipeById`, `getRecipes`, `getAllTagNames` | server-side read helpers; manual join + group-in-JS for the filterable list, Drizzle's relational `with` for the single-recipe read |
| `app/lib/capture.ts` | `captureFromWebUrl`, `captureFromInstagramUrl` | server-side `fetch` of a third-party page/API, never runs in the browser |
| `app/lib/auth.ts` | `AUTH_COOKIE`, `sha256Hex`, `expectedAuthCookie` | Web-Crypto only, shared by the Edge proxy and the Node login action |
| `app/components/want-to-make-toggle.tsx` | the toggle button | the only `"use client"` file in the app |
| `proxy.ts` | the auth gate | runs before every matched request (Edge runtime); redirects to `/login` without a valid cookie |
| `app/globals.css` | Tailwind entry | (not Next specific) |
| `db/index.ts` | Drizzle client | server-only module, imported by Server Components/Actions |
| `db/schema.ts` | Table definitions and relations | (Drizzle, not Next) |
| `db/seed.mts` | Dev seed script | plain script, run with `tsx`, not part of the app |
| `next.config.ts` | Next config, currently empty | config |

## The server/client boundary

Almost everything runs on the server. The one exception is the want-to-make toggle.

- The database client, the connection string, and all query and mutation logic stay
  server-side and never reach the browser bundle.
- `app/components/want-to-make-toggle.tsx` is the only `"use client"` file, and so the only
  place with `useState`-style hooks (`useOptimistic`, `useTransition`) and an `onClick`. It
  earns that because a toggle needs to feel instant, which requires state in the browser.
- The delete button has no "are you sure?" confirmation on purpose: a `confirm()` dialog
  would need a second Client Component for a marginal gain. Left as a plain form-button.

## What runs where

| Concern | Where | How |
|---|---|---|
| Routing | Server | file structure under `app/` |
| Reading data | Server | Server Component calls Drizzle directly |
| Writing data | Server | Server Action called from a form |
| HTML generation | Server | RSC render |
| Navigation between pages | Client | Next's `<Link>` does client-side transitions |
| Interactivity | Client | the want-to-make toggle only; `"use client"` |

## Caching

Every route sets `export const dynamic = "force-dynamic"`: no route-level caching, every
request re-renders from the database. This was a deliberate choice (see DECISIONS): the
alternative, letting pages cache by default and busting them with `revalidatePath` after
each mutation, is faster but relies on never missing a `revalidatePath` call. The mutations
do still call `revalidatePath` on the routes they affect, so switching to the cached model
later is mostly a matter of removing the `force-dynamic` exports.

## How it maps to Vercel

Each dynamic route becomes a serverless function. A request spins up a short-lived function,
which renders the page (querying Neon over HTTP), returns the HTML, and is torn down.
`proxy.ts` runs as an Edge function ahead of all of that. There are no static routes left:
everything reads the DB, cookies, or `searchParams`, so all routes render on demand.

Two env vars are needed in Vercel: `DATABASE_URL` (Neon) and `APP_PASSWORD` (the auth gate;
if unset, the gate is disabled and the app is public).

---

## Next.js features, as they were introduced

| Day | Feature | First appears in | What it does |
|---|---|---|---|
| 1-2 | App Router project | whole `app/` dir | file-based routing, `create-next-app` |
| 1-2 | Root layout | `app/layout.tsx` | the shared `<html>`/`<body>` shell |
| 1-2 | `metadata` export | `app/layout.tsx` | static `<title>` and `<meta>` |
| 3 | Server Component data fetching | `app/page.tsx` | `async` component queries the DB on the server, no `/api` route |
| 3 | Route segment config | `app/page.tsx` | `export const dynamic = "force-dynamic"` |
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
| 10 | `proxy.ts` (was `middleware.ts` pre-16) | project root | one file, runs before every matched request; `export function proxy` + a `config.matcher` regex |
| 10 | Edge runtime constraints | `proxy.ts` + `app/lib/auth.ts` | proxy code can't use Node APIs, so the shared auth helper uses only Web Crypto |
| 10 | `cookies()` from `next/headers` | `login` / `logout` in `app/lib/actions.ts` | read and set cookies inside a Server Action; setting one re-renders the current route |
