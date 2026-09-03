# Side Project 1 — Recipe Capture MVP (Next.js)

First project in the full-stack skill-building track. See `side-project-ideas.md` for the
overall plan and `side-project-decisions-template.md` for the DECISIONS.md you copy into the
repo.

**Goal of THIS project:** understand the modern Next.js full-stack model deeply enough to
explain every part in an interview. Not the recipe pipeline (that is project 2), not Python
(project 2), not real-time (project 3). One tech, understood properly.

**Timebox:** ~10-12 focused days, run in parallel with applications, do not let it block them.

---

## The problem (yours, real)

Recipes pile up in Instagram saves and you forget they exist. You want one place to keep
them, searchable, so "I feel like baking" starts with a list instead of scrolling Instagram.
Reminders and the "can I actually make this now" check come later. This project is just:
**capture, store, find.**

Even the MVP beats Instagram saves, so you will actually use it, which is the point.

---

## Scope

### In v1

- Add a recipe by pasting a URL (web recipe or Instagram) or by typing it in.
- A recipe has: title, source URL, an image, ingredients (freeform text, one per line),
  steps (freeform), notes, tags, a "want to make" flag.
- List view: all recipes, newest first, filter by tag, search by title.
- Detail view.
- Edit and delete.
- One-user auth (it is just you).
- Deployed for real on Vercel with a hosted Postgres.

### Explicitly NOT in v1 (resist these)

- OCR / reading text off the recipe image
- Reel transcription
- Ingredient normalisation, unit conversion, scaling maths
- Pantry, "what can I make now", shopping lists
- Reminders / notifications
- Meal planning / calendar
- Multi-user, sharing, mobile app
- A Python service

If you find yourself building any of the above, stop. That is project 2.

### Optional stretch (only if days 1-10 went smoothly)

- One LLM call to turn a pasted caption blob into pre-filled fields, using the Vercel AI
  SDK from a route handler. Stays in JavaScript, teaches "calling an LLM from Next.js",
  and is the seam where project 2's Python pipeline later plugs in. Cut it without guilt.

---

## Tech choices (each one is a DECISIONS.md entry)

| Choice | Pick | Why (short version, expand in DECISIONS.md) |
|---|---|---|
| Framework | Next.js 15+, App Router | the thing being learned |
| Database | Postgres on Neon | free, serverless, pairs cleanly with Vercel |
| ORM | Drizzle | queries read like SQL so you learn what is actually happening; lighter than Prisma, better on serverless. Prisma is more popular and more "magic", note the tradeoff |
| Auth | password gate in middleware | one user, so a shared secret in an env var is enough and it teaches middleware. Auth.js when there is a second user |
| Styling | Tailwind (+ shadcn/ui if you want prebuilt bits) | deliberately boring, do not think about it |
| URL parsing | native fetch + parse JSON-LD; `cheerio` if needed | most recipe sites publish a `Recipe` JSON-LD block, zero AI needed |
| Instagram | oEmbed endpoint | gives you caption text + a thumbnail, nothing more, plan for that |
| LLM (stretch only) | Vercel AI SDK, one call | keeps project 1 in JS |

---

## Data model (deliberately flat)

```sql
recipe
  id            uuid primary key default gen_random_uuid()
  title         text not null
  source_url    text
  source_type   text            -- 'instagram' | 'web' | 'manual'
  image_url     text            -- thumbnail (oEmbed) or og:image
  ingredients   text            -- freeform, one per line. NOT normalised in v1
  steps         text            -- freeform / markdown
  notes         text
  want_to_make  boolean not null default false
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()

tag
  id    uuid primary key default gen_random_uuid()
  name  text not null unique

recipe_tag
  recipe_id  uuid references recipe(id) on delete cascade
  tag_id     uuid references tag(id)    on delete cascade
  primary key (recipe_id, tag_id)
```

`ingredients` and `steps` are text on purpose. The ingredient graph (densities, unit
conversion, substitutions) is a real problem and it is project 2's, not a v1 distraction.
The one modelling concept to actually learn here is the `recipe_tag` many-to-many.

---

## Features mapped to the Next.js concept each one teaches

| Feature | What it is there to teach you |
|---|---|
| Recipe list page | React Server Components: fetch data on the server, query the DB directly, no client loading state, no `useEffect` |
| Recipe detail page | dynamic routes `app/recipes/[id]/page.tsx`, `generateMetadata`, `notFound()` |
| Add recipe (manual form) | Server Actions: `<form action={fn}>`, mutation next to the component, `redirect()` after |
| Add recipe (paste URL) | server-side `fetch` of an external page, JSON-LD parsing, the failure/fallback path |
| Add recipe (paste Instagram caption) | a second server-action code path; progressive enhancement (form works with JS disabled) |
| Edit / delete | `revalidatePath`, and the caching model, this is the confusing part, go slow here |
| Tags + filter + search | `searchParams` as state, `<Link>` navigation, "the URL is the state" |
| "Want to make" toggle | the ONE `'use client'` component, `useOptimistic`, feeling the client/server boundary |
| Auth | `middleware.ts`, protecting routes, reading a cookie/secret |
| Deploy | Vercel, env vars, preview deployments, connecting Neon |
| LLM structuring (stretch) | route handler `app/api/parse/route.ts`, secrets, calling an external API from the server |

---

## Week by week

**Days 1-2: scaffold and deploy an empty app**
- `create-next-app` (TypeScript, Tailwind, App Router). Neon project. Drizzle set up, first
  migration with the `recipe` table.
- Deploy to Vercel on day 1, before there is anything to show. Deploy early, deploy often.
- DECISIONS: ORM choice, DB host choice.

**Days 3-4: the read path (RSC core)**
- List page and detail page as Server Components querying Drizzle directly.
- Understand why there is no spinner, what runs on the server vs the client, `loading.tsx`
  and Suspense.
- DECISIONS: "queried the DB directly in a Server Component instead of building an API
  route, why that is fine here and when it would not be".

**Days 5-6: the write path (Server Actions)**
- Manual add form, edit, delete, all via server actions.
- `revalidatePath` and the caching model. Slow down. Write the DECISIONS entry only once
  you can explain in your own words when a page is cached and what busts it.

**Day 7: URL capture**
- Paste a web URL, fetch it server-side, parse JSON-LD `Recipe`, pre-fill the form.
- Paste an Instagram URL, call oEmbed, pull caption + thumbnail into the form.
- Both failure cases fall back to "paste the text yourself".
- DECISIONS: the fallback ladder; why parsing is server-side.

**Day 8: tags, filter, search**
- `recipe_tag` many-to-many. Filter and search driven by `searchParams`.
- DECISIONS: URL as state, why filters are not React state.

**Day 9: the one client component**
- "Want to make" toggle: `'use client'`, `useOptimistic`, a server action.
- DECISIONS: why this is a client component and nothing else is.

**Day 10: auth and polish**
- Password gate in `middleware.ts`. Empty states, responsive pass, favicon.
- DECISIONS: why a shared secret is enough for now, what would change with a second user.

**Days 11-12: use it and write it up**
- Import 15-20 recipes you have actually saved. Live with it for a few days.
- README: the problem, a screenshot or GIF, the architecture in five sentences, a link to
  DECISIONS.md.
- Buffer for overrun (there will be some).

---

## Done when

- It is deployed, you have real recipes in it, and you have opened it unprompted at least
  once to find something.
- `DECISIONS.md` has an entry for every choice in the table above, each one written by you,
  each one something you could defend in an interview.
- The README links to DECISIONS.md.

## What you can say in an interview afterwards

- "Small app, but I can walk you through every decision, here is the log."
- "Server Components mean the list page has no client data fetching at all, the DB query
  runs on the server and the HTML arrives populated. The one client component is the
  want-to-make toggle, because it needs optimistic UI."
- "The interesting part was capture. Instagram gives you a caption and a thumbnail and
  nothing else reliably, so it is a fallback ladder: JSON-LD, then oEmbed, then paste it
  yourself. I did not assume the happy path."
- Honest about the boring parts: "auth is a password in an env var, that is all it needs
  right now".

---

## The rule that keeps this a learning project

Do not merge code you cannot explain line by line. Every DECISIONS entry must be something
you could defend out loud. If you cannot write the entry, you do not understand the choice
yet, stop and learn it before moving on. Use AI to explain and to review your entries, not
to hand you code you then nod at.
