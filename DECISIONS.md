# Decisions

A log of the choices made in this project and why. Newest at the top.

Rule I'm holding myself to: I don't merge code I can't explain line by line, and every entry
below is something I could defend in an interview. If I can't write the entry, I don't
understand the choice yet.

---

## Decisions to document

Tracking list. Every unchecked item still needs its own entry below (newest on top), written
in my own words. Checked means the entry is written.

### Stack and infrastructure

- [x] **React** as the UI library. Easy call: I already know it, and I want zero friction on
      the parts I am not here to learn. Alternatives: Vue, Svelte, SolidJS, Angular.
- [x] **Next.js (App Router)** as the framework. Not really a choice, it is the thing being
      learned, but worth stating what I am buying and the alternatives I am skipping: Remix /
      React Router 7, TanStack Start, Astro, SvelteKit, Nuxt, or a plain Vite SPA plus a
      separate API server.
- [x] **Vercel** for hosting. Deployed. Alternatives: Netlify, Cloudflare Pages, Render,
      Railway, Fly.io, AWS Amplify, self-hosted VPS or Docker container.
- [x] **Postgres on Neon** (database type and host). Alternatives: NoSQL (MongoDB), SQLite;
      hosts: self-managed VPS, always-on managed instance (RDS), Supabase.
- [x] **Drizzle** as the ORM. Alternatives: Prisma, Kysely, raw SQL via node-postgres.
- [x] **Tailwind** for styling. Alternatives: CSS Modules, vanilla-extract,
      styled-components, Panda CSS.
- [x] **shadcn/ui** for components (post-build UI pass). Alternatives: Mantine, MUI, Radix
      primitives hand-styled, keep raw Tailwind.
- [x] **Auth: shared password checked in middleware.** Alternatives: Auth.js, Clerk, Lucia,
      Supabase Auth.
- [x] **URL capture: native fetch plus JSON-LD parsing** (cheerio if needed). Alternatives:
      a scraping service, a headless browser, a paid recipe API.
- [x] **Instagram capture: oEmbed endpoint.** Alternatives: Graph API, scraping, manual
      paste only.
- [ ] **LLM field pre-fill** (stretch, cuttable): Vercel AI SDK, one call. Alternatives:
      direct Anthropic SDK, or skip entirely.

### Patterns and architecture (write these as they come up in the build)

- [x] Querying the DB directly in a Server Component vs building an API route (days 3-4)
- [x] Server Action vs Route Handler for mutations (days 5-6)
- [x] revalidatePath and the caching model: when a page is cached and what busts it (days 5-6)
- [x] Data model shape: `ingredients` and `steps` as freeform text, not normalised tables;
      the `recipe_tag` many-to-many (already in the schema)
- [x] `searchParams` in the URL as filter and search state, not React state (day 8)
- [x] The "want to make" toggle as the single client component, `useOptimistic` (day 9)

---

## shadcn/ui for components

**Date:** 06/09/2026

**Context:** After the build was functionally done, the raw-Tailwind UI was rough: cramped
forms, inconsistent spacing, small controls, a couple of visual bugs. Making it usable
needed either a lot of hand-styling or a component library.

**Options I considered:**
- Keep hand-rolling with raw Tailwind
- shadcn/ui: component source copied into the repo, built on Tailwind + Radix
- Mantine: a full component library with its own styling system
- MUI: Material Design components

**Chose:** shadcn/ui.

**Why:** building a custom UI is not the point of this project, and shadcn is the popular,
well-trodden option in the Next.js world, so it's low-risk and useful to know. It sits on
Tailwind (no new styling system to learn) and Radix (accessible dialogs, dropdowns, focus
and keyboard handling for free). It isn't an npm dependency: the CLI copies component code
into the repo, so I own it and can read and adjust it, which suits a learning project.
Mantine and MUI would each mean adopting a whole styling system I'd have to learn, for a
project where the UI is not the goal.

**What I'd revisit this under:** a project where the visual identity matters. shadcn's
defaults are deliberately neutral, so a shadcn app looks like every other shadcn app until
you invest in restyling it.

**Follow-up (06/09/2026):** the stock zinc theme did look too generic for a recipe app, so
I themed it: a "warm paper + terracotta" palette (neutrals carry a slight warm hue, the
primary is a burnt orange-red) and a serif (Fraunces) for headings. This is all CSS
variables in `globals.css` plus one font in `layout.tsx`, no component changes, which is
exactly the point of picking a token-themed library. shadcn gave the structure, the theme
gave the personality.

**Confidence:** high. The library choice was right; the "generic is fine" line was wrong,
and cheap to fix.

---

## Password auth in proxy.ts, not a real auth system

**Date:** 06/09/2026

**Context:** The app has one user, me. It still needs to not be world-writable once it's on a
public URL. The question was how much auth is actually warranted.

**Options I considered:**
- A real auth library (Auth.js, Clerk, Lucia): user accounts, sessions, password hashing, social login
- A shared password checked in `proxy.ts`: one secret in an env var, one cookie

**Chose:** the shared password.

**Why:** there is nothing a real auth system's features would do here. No second user, no
per-user data, no roles, no "who did what". The only thing being protected is "a stranger
who finds the URL can't edit my recipes." A password in an env var covers exactly that, and
it is also the smaller thing to understand and the reason to learn how `proxy.ts` works.
The cookie holds `SHA-256(password)` rather than the password itself so a leaked cookie
doesn't expose the secret in plaintext.

**What I'd revisit this under:** a second user. That flips it entirely: real identity
(accounts, per-user password hashes, sessions), and the checks move into the data layer
too, because the proxy gate alone can't answer "is this *your* recipe". At that point it's
Auth.js, not a bigger password.

**Confidence:** high on why this is enough now. Medium on the exact migration path to real
auth, I know the shape but haven't done it.

---

## Server Actions for every mutation, not Route Handlers

**Date:** 06/09/2026

**Context:** Every write in the app (add, edit, delete, toggle, tags, login) needed a
server-side entry point. Next gives two options: a Server Action, or a Route Handler
(`app/api/.../route.ts`, a plain HTTP endpoint).

**Options I considered:**
- Server Actions: functions marked `"use server"`, wired straight to a `<form action>` or
  called from a client component
- Route Handlers: define an HTTP endpoint, POST to it from the client

**Chose:** Server Actions for all of them.

**Why:** the mutation lives next to the component that triggers it, there is no endpoint to
name, route, and secure separately, and a form wired to a Server Action still submits with
JavaScript disabled. A Route Handler only earns its place when the caller is *not* my own
UI: an external service, a webhook, a mobile app, or a streaming response. Nothing in v1 is
that. The one future candidate is the stretch LLM parse feature, which the SPEC deliberately
frames as a Route Handler so it's a clean seam for project 2's Python service.

**What I'd revisit this under:** needing any of the app's write logic callable from outside
this app, or a mutation that needs to stream its response.

**Confidence:** high.

---

## Querying Postgres directly in Server Components, no API layer

**Date:** 06/09/2026

**Context:** The list and detail pages need to read recipes from Postgres and render them.
The React apps I've worked in did that with a client component calling a `/api/recipes`
endpoint and a loading spinner.

**Options I considered:**
- Client component + `/api/recipes` route + `fetch` + loading state: the pattern I knew
- Server Component that imports the Drizzle client and queries the DB directly: no endpoint,
  no client fetch, no spinner

**Chose:** the Server Component querying directly.

**Why:** these pages are read-only and render on the server, so there is no reason to
round-trip HTTP to my own machine. The query runs during render, the HTML arrives with the
data in it, and there is no loading state to design because the user never sees an empty
page. An API route would only be worth it if something outside this app needed the same
data. Nothing does.

**What I'd revisit this under:** adding a second client (a mobile app), or a query getting
slow enough that I want to stream the page with the list in a Suspense boundary, or needing
the recipe data from a background job.

**Confidence:** high. This is the single biggest shift from the client-fetch model I was
used to, and I can explain exactly why it's fine here.

---

## Data model: flat, with `ingredients` and `steps` as text

**Date:** 06/09/2026

**Context:** How structured should a recipe be. The obvious pull is to model ingredients as
their own table with quantities and units.

**Options I considered:**
- Normalised: an `ingredient` table, a `recipe_ingredient` table with amount + unit, unit
  conversion, etc.
- Flat: `ingredients` and `steps` are `text` columns, one item per line, exactly as typed

**Chose:** flat.

**Why:** the structured ingredient graph (units, densities, substitutions, scaling) is a
real, hard problem, and it is explicitly project 2's, not a v1 distraction. v1 only needs to
store what I typed and show it back. The one relational concept worth practising here is the
tag many-to-many, not the ingredient graph.

Tags *are* a separate `tag` table plus a `recipe_tag` join, not a text column on `recipe`,
because a tag is shared across many recipes: stored once and pointed at, so renaming a tag
or listing every tag is a single-row operation instead of a scan-and-dedupe over every
recipe.

**What I'd revisit this under:** wanting any feature that needs to reason about ingredients
as data (a shopping list, "can I make this now", scaling). That is the project 2 boundary.

**Confidence:** high. The scope line is drawn in the SPEC and this respects it.

---

## Tailwind for styling

**Date:** 06/09/2026

**Context:** The app needs styling. Styling is explicitly not what this project is for.

**Options I considered:**
- Tailwind: utility classes in the markup
- CSS Modules, vanilla-extract, styled-components, Panda CSS: some form of separate styles

**Chose:** Tailwind.

**Why:** it's the choice that lets me spend the least time on styling. No separate files, no
naming classes, no context-switching out of the component. It's also the create-next-app
default, so zero setup. The cost is long `className` strings and having to learn the utility
names, both of which I accept for a project where the visual design does not matter.

**What I'd revisit this under:** a project where design *is* a goal, or a component set big
enough to want a real library (I'd add shadcn/ui, which is Tailwind underneath anyway).

**Confidence:** high, and low stakes.

---

## Vercel for hosting

**Date:** 06/09/2026

**Context:** The app needs to be deployed somewhere real. Deployment is not the thing being
learned.

**Options I considered:**
- Vercel: made by the Next.js team
- Netlify, Cloudflare Pages: similar git-push platforms
- Render, Railway, Fly.io: general PaaS, run Next as a long-lived Node server
- Self-hosted VPS or a container: full control, own the ops

**Chose:** Vercel.

**Why:** every Next.js feature is built and tested on Vercel first, it's zero-config (detects
Next, just works), git push deploys, every branch gets a preview URL, and the free tier
covers a personal app. Deployment friction here is wasted time, so the reference path wins.
The cost is soft lock-in to some Vercel-specific behaviour and a pricing cliff past the free
tier that would bite a high-traffic site.

**What I'd revisit this under:** real traffic making the pricing matter, or wanting to learn
deployment and infrastructure as its own goal (then a VPS or container).

**Confidence:** high.

---

## Next.js App Router as the framework

**Date:** 06/09/2026

**Context:** Not a free choice, learning Next.js is the entire point of this project. But
worth stating what that buys and what's being skipped.

**Options I considered:**
- Next.js App Router: the current model, RSC + Server Actions
- Next.js Pages Router: the older Next model
- Remix / React Router 7, TanStack Start: other React meta-frameworks
- SvelteKit, Nuxt, Astro: other-framework equivalents
- A plain Vite SPA plus a separate API server: the setup I already know

**Chose:** Next.js, App Router.

**Why:** it's the framework that shows up most in the job specs I'm targeting, and the App
Router (not Pages) is where it's heading, so learning the current model is the point. It also
forces me to actually understand the server/client split rather than defaulting to a SPA.

**What I'd revisit this under:** nothing for this project. In general, Remix/React Router is
the closest alternative and I'd want to be able to argue Next vs it on the merits, which I
can't fully yet.

**Confidence:** high that this is what I want to learn. Medium on comparing it to Remix in
depth.

---

## React as the UI library

**Date:** 06/09/2026

**Context:** Something has to render the UI.

**Options I considered:** React, Vue, Svelte, SolidJS, Angular.

**Chose:** React.

**Why:** I've used it for years, so it adds no cognitive load on top of the thing I'm
actually here to learn. Next.js is built on React anyway, so this isn't really a separate
decision. I wanted friction concentrated on the new material, not the familiar layer.

**What I'd revisit this under:** nothing for this project.

**Confidence:** high, trivially.

---

## Want-to-make toggle: the one Client Component

**Date:** 05/09/2026

**Context:** Every other mutation in the app (add, edit, delete, tags) is a full page
navigation or an explicit save, so a Server Component and a brief round trip are fine. The
want-to-make toggle is a repeated micro-interaction, closer to a light switch than a form
submit, and needed to decide if that changes anything.

**Options I considered:**
- A form + Server Action like the rest of the app: click, wait for the round trip, the whole
  page re-renders with the new state
- A Client Component with `useOptimistic` and `useTransition`: flips the UI on the same
  frame the click happens, reconciles with the real value once the server responds

**Chose:** the Client Component.

**Why:** the test I used was "is there a per-click delay here a user would notice and
dislike." Everywhere else in the app fails that test: adding or editing a recipe is a
deliberate, occasional action where a moment's wait reads as normal, and filtering by tag is
a navigation, not a rapid repeated click. A toggle is the opposite, it invites clicking it a
few times in a row, and a visible lag on each click would feel broken. That gap is worth the
cost of the one client-side file, one hook I hadn't used before, and one interaction where a
stale-optimistic-value bug could exist that cannot happen anywhere else in this app.

**What I'd revisit this under:** if another interaction needed the same instant feel, for
example inline editing a field without a full form, I would reuse this exact pattern rather
than invent a different one.

**Confidence:** high on the reasoning for why this one and nothing else. Still building
confidence on `useOptimistic` edge cases I have not hit yet, like rapid double-clicks or what
the UI should do if the action actually fails.

---

## The URL as filter/search state, not React state

**Date:** 04/09/2026

**Context:** The list page needs to filter by tag and search by title. The list page is a
Server Component with no client JS at all, so adding a filter meant deciding where that
"which recipes am I looking at" state actually lives.

**Options I considered:**
- `useState` in a Client Component: hold the tag/search text in memory, filter or refetch on change
- `searchParams`: read `?tag=` and `?q=` straight off the URL in the Server Component, drive
  filtering with plain `<Link>`s and a native GET `<form>`

**Chose:** `searchParams`.

**Why:** the list page had zero client JS before this and I wanted to keep it that way, so
`useState` would mean turning a plain Server Component into a Client Component for no
interactivity gain. The URL is also just the correct model for this: which recipes I'm
looking at should be shareable, bookmarkable, and survive a refresh, none of which a
`useState` filter does. It also meant no client JS was needed at all: tag pills are plain
links to `/?tag=x`, and the search box is a native `<form method="get">` the browser turns
into that same kind of URL on submit. The database does the actual filtering (a real SQL
`ILIKE`, a real join), not the browser.

**What I'd revisit this under:** if search needed to feel instant while typing (live
results, no navigation), that wants client state and a debounced fetch, at which point I'd
still keep the URL in sync for shareability rather than dropping it.

**Confidence:** high. This is a well-worn Next.js pattern and I can see exactly why it fits
here: no interactivity was needed, just different data based on the URL.

---

## Recipe capture: server-side fetch, JSON-LD, oEmbed, and a fallback ladder

**Date:** 04/09/2026

**Context:** Adding a recipe by pasting a URL instead of typing everything by hand. Two
sources with different shapes: recipe websites and Instagram. Neither reliably has clean
data, so the design question was really "what happens when this fails," not just "how do I
fetch it."

**Options I considered:**
_Where the fetch happens:_
- Client-side `fetch` from the browser: blocked by CORS on most sites, exposes the scraping
  logic, can't set a custom User-Agent
- Server-side `fetch` inside a Server Action: no CORS, logic and any keys stay off the client

_Getting structured data from a web recipe:_
- A paid recipe API (Spoonacular etc.): reliable, costs money, another account to manage
- A headless browser (Puppeteer): handles JS-rendered pages, heavy for this app's needs
- Parse the page's own `Recipe` JSON-LD: free, works because most recipe sites publish it
  for Google's own rich-results feature, no dependency needed beyond a regex

_Getting anything from Instagram:_
- Graph API with an approved app + access token: real setup for a personal project
- Scraping the page HTML directly: fragile, likely against Instagram's terms
- The public oEmbed endpoint: simplest, though known to be restricted for many accounts
- Manual paste only: the safety net regardless of which of the above I try first

**Chose:** server-side fetch for both, JSON-LD parsing for web recipes, oEmbed for
Instagram, and every path falls back to an empty form the user fills in by hand.

**Why:** parsing has to run on the server because of CORS and because I don't want scraping
logic or any future API keys in the client bundle. JSON-LD needed no new dependency, a plain
regex over `<script type="application/ld+json">` tags was enough, cheerio would only earn
its place if I needed to read the visible DOM instead of an embedded script tag. Both
sources are unreliable in practice, not in theory: a real site I tested against had an
unquoted `type=application/ld+json` attribute my first regex missed, and Instagram's oEmbed
is documented to fail for many URLs without an approved app. Building the fallback in from
the start, rather than assuming success, is why the feature works at all: every failure just
means an empty form and a message, never a crash.

**What I'd revisit this under:** if capture success rate on real sites turns out too low to
be useful, worth trying cheerio for sites without JSON-LD. If Instagram import matters more
than "occasionally works," that is when a Graph API app becomes worth the setup.

**Confidence:** high on why this runs server-side and why the fallback ladder matters, that
part I saw fail and recover myself. Lower on how robust the regex-based JSON-LD parser is
across the wider variety of real sites, only tested against a couple so far.

---

## force-dynamic over the cached-plus-revalidate model

**Date:** 04/09/2026

**Context:** Recipe pages read from Postgres via Drizzle, not `fetch`, so Next's automatic
caching heuristics don't see them. Without telling Next what to do, a page could get
rendered once and frozen, never showing new recipes.

**Options I considered:**
- `force-dynamic` on every dynamic route: always re-render fresh from the DB, no caching
- Default caching + `revalidatePath` after every mutation: pages cached until explicitly
  busted, faster for readers, but I have to remember to revalidate everywhere data changes

**Chose:** `force-dynamic` everywhere for now.

**Why:** it's simple and impossible to get wrong: every request is fresh, always. The
cache-plus-revalidate model is faster but depends on me correctly revalidating every path
touched by every mutation, and I don't understand Next's caching layers well enough yet to
trust myself not to leave a stale page somewhere.

**What I'd revisit this under:** once I've built more of the app (tags, filters) and have a
solid feel for which pages need to update when, or if the DB query load becomes a real cost.

**Confidence:** still fuzzy on the caching layers themselves. High confidence that choosing
the safe default here, given that, was the right call.

---

## Postgres on Neon for the database

**Date:** 03/09/2026

**Context:** The app needs permanent storage for recipes. Two questions: what _kind_ of
database, and _who runs it_. The hosting question is real because the app is on Vercel,
which is serverless: short-lived functions per request, no long-running server.

**Options I considered:**
_Database type:_
- Relational / SQL (Postgres, MySQL): tables with enforced relationships
- SQLite: relational, but a single file rather than a server
- NoSQL / document (MongoDB): flexible documents, no rigid schema

_Host:_
- Self-hosted on a Linux box: I own backups, patching, failover
- Managed always-on instance (AWS RDS): provider runs it, billed 24/7
- Neon: managed and serverless, compute sleeps when idle, pay per use
- Supabase: managed Postgres bundled with auth, storage, realtime, auto-REST

**Chose:** Postgres, hosted on Neon.

**Why:** Recipe data is relational (tags shared across recipes, the recipe_tag join is the
core modelling idea), so a relational database fits and NoSQL would mean duplicating data or
joining in app code. Postgres is also the JS/TS default now, which means strong tooling and
hiring signal, though that reinforces the choice rather than being the reason for it. Not
SQLite because serverless has no persistent machine to hold the file. Neon over self-hosting
or RDS because I do not want to own database ops, and Neon scales to zero and costs about
nothing at this usage where an always-on instance would not. Neon over Supabase because I
only need a connection string, not a whole platform. Neon also fits serverless directly: its
pooler and HTTP driver stop hundreds of function invocations from exhausting Postgres's
connection limit.

**What I'd revisit this under:** steady high traffic (scale-to-zero stops paying off,
a fixed instance is cheaper with no cold starts), needing multi-statement transactions
everywhere (first fix is Neon's WebSocket driver, not leaving Neon), or the backend moving
off serverless to a long-lived server (the connection problem disappears, plain managed
Postgres becomes simpler).

**Confidence:** High

---

## Drizzle as the ORM

**Date:** 04/09/2026

**Context:** Need to query Postgres from TypeScript. Options run from raw SQL to a full ORM
that hides it. The two real Next.js candidates are Drizzle and Prisma.

**Options I considered:**
- Raw SQL via node-postgres: full control, no type safety
- Kysely: typed query builder, no schema or migration management
- Drizzle: TS schema, SQL-like queries, plain-SQL migrations, types inferred from schema
- Prisma: own schema language, codegen step, higher-level API, own migration engine, most popular

**Chose:** Drizzle.

**Why:** Drizzle's query builder mirrors SQL clause for clause, and its schema and migrations
are plain readable TypeScript and SQL, so it teaches me what actually happens at the
database, which is the point of this project. It is also just TypeScript with no codegen
step, no engine binary, and no schema file that can drift, which suits serverless. Prisma's
cleaner high-level API and bigger ecosystem win when optimising for shipping speed over
understanding, which I am not.

**What I'd revisit this under:** joining a team standardised on Prisma, Drizzle's API
churning painfully, hitting a query it expresses badly, or wanting Prisma Studio and its
migration workflow enough to switch.

**Confidence:** medium. High on the learning rationale, less sure on the serverless-perf
claims (the engine-binary cost is mostly historical now). Revisit after day 5-6.

<!-- TEMPLATE below: copy it for each new entry. New entries go directly under the
     "Decisions to document" list, newest first. -->

## <short title of the decision>

**Date:** YYYY-MM-DD

**Context:** what was I trying to do, what constraint made this a real choice.

**Options I considered:**

- Option A - one line on what it is
- Option B - one line
- Option C - one line

**Chose:** Option B.

**Why:** the actual reasoning. Not "it's the standard", say what it buys me here and what it
costs.

**What I'd revisit this under:** the condition that would make me change my mind later.

**Confidence:** high / medium / still fuzzy on this.
