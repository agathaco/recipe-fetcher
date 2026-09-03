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
- [ ] **Postgres on Neon** (database type and host). Alternatives: NoSQL (MongoDB), SQLite;
  hosts: self-managed VPS, always-on managed instance (RDS), Supabase.
- [ ] **Drizzle** as the ORM. Alternatives: Prisma, Kysely, raw SQL via node-postgres.
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
- [ ] revalidatePath and the caching model: when a page is cached and what busts it (days 5-6)
- [ ] Data model shape: `ingredients` and `steps` as freeform text, not normalised tables;
  the `recipe_tag` many-to-many (already in the schema)
- [ ] `searchParams` in the URL as filter and search state, not React state (day 8)
- [ ] The "want to make" toggle as the single client component, `useOptimistic` (day 9)

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
