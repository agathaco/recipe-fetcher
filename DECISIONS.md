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

- [ ] **React** as the UI library. Easy call: I already know it, and I want zero friction on
      the parts I am not here to learn. Alternatives: Vue, Svelte, SolidJS, Angular.
- [ ] **Next.js (App Router)** as the framework. Not really a choice, it is the thing being
      learned, but worth stating what I am buying and the alternatives I am skipping: Remix /
      React Router 7, TanStack Start, Astro, SvelteKit, Nuxt, or a plain Vite SPA plus a
      separate API server.
- [ ] **Vercel** for hosting. Deployed. Alternatives: Netlify, Cloudflare Pages, Render,
      Railway, Fly.io, AWS Amplify, self-hosted VPS or Docker container.
- [x] **Postgres on Neon** (database type and host). Alternatives: NoSQL (MongoDB), SQLite;
      hosts: self-managed VPS, always-on managed instance (RDS), Supabase.
- [x] **Drizzle** as the ORM. Alternatives: Prisma, Kysely, raw SQL via node-postgres.
- [ ] **Tailwind** for styling (maybe shadcn/ui). Alternatives: CSS Modules, vanilla-extract,
      styled-components, Panda CSS.
- [ ] **Auth: shared password checked in middleware.** Alternatives: Auth.js, Clerk, Lucia,
      Supabase Auth.
- [x] **URL capture: native fetch plus JSON-LD parsing** (cheerio if needed). Alternatives:
      a scraping service, a headless browser, a paid recipe API.
- [x] **Instagram capture: oEmbed endpoint.** Alternatives: Graph API, scraping, manual
      paste only.
- [ ] **LLM field pre-fill** (stretch, cuttable): Vercel AI SDK, one call. Alternatives:
      direct Anthropic SDK, or skip entirely.

### Patterns and architecture (write these as they come up in the build)

- [ ] Querying the DB directly in a Server Component vs building an API route (days 3-4)
- [ ] Server Action vs Route Handler for mutations (days 5-6)
- [x] revalidatePath and the caching model: when a page is cached and what busts it (days 5-6)
- [ ] Data model shape: `ingredients` and `steps` as freeform text, not normalised tables;
      the `recipe_tag` many-to-many (already in the schema)
- [x] `searchParams` in the URL as filter and search state, not React state (day 8)
- [ ] The "want to make" toggle as the single client component, `useOptimistic` (day 9)

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
