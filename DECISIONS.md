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
- [ ] **URL capture: native fetch plus JSON-LD parsing** (cheerio if needed). Alternatives:
      a scraping service, a headless browser, a paid recipe API.
- [ ] **Instagram capture: oEmbed endpoint.** Alternatives: Graph API, scraping, manual
      paste only.
- [ ] **LLM field pre-fill** (stretch, cuttable): Vercel AI SDK, one call. Alternatives:
      direct Anthropic SDK, or skip entirely.

### Patterns and architecture (write these as they come up in the build)

- [ ] Querying the DB directly in a Server Component vs building an API route (days 3-4)
- [ ] Server Action vs Route Handler for mutations (days 5-6)
- [x] revalidatePath and the caching model: when a page is cached and what busts it (days 5-6)
- [ ] Data model shape: `ingredients` and `steps` as freeform text, not normalised tables;
      the `recipe_tag` many-to-many (already in the schema)
- [ ] `searchParams` in the URL as filter and search state, not React state (day 8)
- [ ] The "want to make" toggle as the single client component, `useOptimistic` (day 9)

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
