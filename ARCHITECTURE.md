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

## The two request lifecycles

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
4. The action validates input, does a Drizzle `insert`, calls `revalidatePath("/")` to mark
   the list page stale, then `redirect()`.
5. Next sends back a redirect. The browser lands on the new recipe's page, which renders
   fresh via lifecycle 1.
6. This works with JavaScript disabled, because it is a real form POST.

## File map

| File | What it is | Next.js feature |
|---|---|---|
| `app/layout.tsx` | Root layout, wraps every page | Layouts, `metadata` |
| `app/page.tsx` | Recipe list at `/` | Server Component, direct DB query, `dynamic` |
| `app/recipes/[id]/page.tsx` | One recipe at `/recipes/:id` | Dynamic route, `await params`, `generateMetadata`, `notFound()` |
| `app/recipes/new/page.tsx` | Add form at `/recipes/new` | Server Component form, `<form action={}>` |
| `app/recipes/[id]/edit/page.tsx` | Edit form at `/recipes/:id/edit` | pre-filled form, `updateRecipe.bind(null, id)` |
| `app/lib/actions.ts` | `createRecipe`, `updateRecipe`, `deleteRecipe` | Server Actions (`"use server"`), `.bind()`, `revalidatePath`, `redirect` |
| `app/lib/data.ts` | `getRecipeById` | plain server-side read helper, shared by detail and edit pages |
| `app/lib/capture.ts` | `captureFromWebUrl`, `captureFromInstagramUrl` | server-side `fetch` of a third-party page/API, never runs in the browser |
| `app/globals.css` | Tailwind entry | (not Next specific) |
| `db/index.ts` | Drizzle client | server-only module, imported by Server Components/Actions |
| `db/schema.ts` | Table definitions | (Drizzle, not Next) |
| `next.config.ts` | Next config, currently empty | config |

## The server/client boundary

Nothing in this app is a Client Component yet. Everything runs on the server. That means:

- The database client, the connection string, and all query logic stay server-side and never
  reach the browser bundle.
- There is no `useState`, `useEffect`, or `onClick` anywhere yet.
- The first `"use client"` component will be the "want to make" toggle (day 9), because it
  needs optimistic UI. That is the one place interactivity is worth the client JS.
- The delete button has no "are you sure?" confirmation on purpose: a `confirm()` dialog
  needs an `onClick`, which needs a Client Component. Adding one now would mean a second
  client component before day 9, ahead of the SPEC's plan. Revisit once the want-to-make
  toggle establishes the client boundary pattern.

## What runs where

| Concern | Where | How |
|---|---|---|
| Routing | Server | file structure under `app/` |
| Reading data | Server | Server Component calls Drizzle directly |
| Writing data | Server | Server Action called from a form |
| HTML generation | Server | RSC render |
| Navigation between pages | Client | Next's `<Link>` does client-side transitions |
| Interactivity | Client | none yet; `"use client"` when needed |

## Caching (evolving, day 5-6)

Both dynamic pages currently set `export const dynamic = "force-dynamic"`, which means "run
the query on every request, never serve a cached copy". This is a blunt instrument. Days 5-6
replace it with the real model: pages are cached by default, and `revalidatePath` /
`revalidateTag` mark specific things stale after a mutation. `createRecipe` already calls
`revalidatePath("/")` in anticipation of that.

## How it maps to Vercel

Each dynamic route becomes a serverless function. A request spins up a short-lived function,
which renders the page (querying Neon over HTTP), returns the HTML, and is torn down. Static
routes (`/recipes/new` right now) are served as prebuilt HTML from the CDN.

---

## Next.js features, as they were introduced

| Day | Feature | First appears in | What it does |
|---|---|---|---|
| 1-2 | App Router project | whole `app/` dir | file-based routing, `create-next-app` |
| 1-2 | Root layout | `app/layout.tsx` | the shared `<html>`/`<body>` shell |
| 1-2 | `metadata` export | `app/layout.tsx` | static `<title>` and `<meta>` |
| 5-6 | `title.template` | `app/layout.tsx` | child pages set just their own title; the layout wraps it, e.g. "Add a recipe · Recipes" |
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
| 5-6 | Bound Server Action | `updateRecipe`/`deleteRecipe` in `app/lib/actions.ts` | `action.bind(null, id)` passes an id into a Server Action invoked from a form, with no hidden `id` input needed |
| 7 | `searchParams` page prop | `app/recipes/new/page.tsx` | reads query params as pre-fill data, a Promise like `params` |
| 7 | Server-side `fetch` of a third party | `app/lib/capture.ts` | runs only on the server; the site being scraped never sees the user's browser, and no API key or fetch logic reaches the client bundle |
| 7 | Mutation-that-redirects-with-data | `importFromUrl` in `app/lib/actions.ts` | a Server Action that does no DB write, just carries results forward via a redirect's query string instead of persisting a draft |
