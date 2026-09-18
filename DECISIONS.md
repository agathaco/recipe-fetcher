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
- [x] **Auth: shared password checked in middleware** (superseded 16/09/2026, see below).
      Alternatives: Auth.js, Clerk, Lucia, Supabase Auth.
- [x] **Real multi-user accounts**, hand-rolled again rather than adopting Auth.js.
      Alternatives: Auth.js, Clerk, Lucia, Supabase Auth.
- [x] **bcrypt for password hashing**, replacing the SHA-256-based approach used for the
      old shared password. Alternatives: `crypto.scrypt`, Argon2.
- [x] **Tags become per-user**, not global.
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
- [x] Testing: Vitest for units, Playwright for the RSC / Server Action flows
- [x] Error handling: `error.tsx` boundary, `useActionState` for forms, toasts for optimistic actions
- [x] How migrations reach production: `vercel-build` gated on `VERCEL_ENV`, not a manual step
- [x] Real sessions instead of a static password-digest cookie
- [x] Pulling the want-to-make marker off the list cards with no replacement yet
- [x] Photo uploads: Vercel Blob, client-direct, via a Route Handler
- [x] Cutting Instagram capture
- [x] No login rate limiting, despite the finding
- [x] `getCurrentUser()` re-derivation instead of threading auth state through headers

---

## `getCurrentUser()` re-derivation instead of threading auth state through headers

**Date:** 16/09/2026

**Context:** `proxy.ts` already knows who's signed in (it has to, to decide whether to
redirect to `/login`), but Next has no built-in channel to pass data from Proxy to a
Server Component or Server Action downstream. Every page and mutation that now needs
`ownerId` has to get it from somewhere.

**Options I considered:**
- Have `proxy.ts` set a custom request header (e.g. `x-user-id`) and read it back with
  `headers()` in Server Components/Actions.
- Re-run the same cookie -> session -> user lookup a second time, in a `getCurrentUser()`
  helper called directly wherever the data is needed.

**Chose:** re-derivation, via `app/lib/session.ts`'s `getCurrentUser()`.

**Why:** the header approach works but means trusting a header nothing stops another
part of the stack from spoofing if it's ever misconfigured, and it silently couples
every consumer to a specific proxy implementation detail. Re-deriving is one extra
indexed-primary-key lookup (`session.id`, already the query proxy.ts runs), on Neon's
HTTP driver that's a few milliseconds, and the project already treats DB reads as cheap
and unworried-about (see the `force-dynamic` and "querying Postgres directly" entries
below). `React.cache()` wraps it so multiple call sites in one request (a page plus a
layout, say) collapse to a single query instead of one each.

**What I'd revisit this under:** a much colder DB round-trip (a non-serverless driver
with real connection setup cost), or needing the same session data in genuinely
non-Server-Component contexts (a Route Handler with no natural place to call an async
helper) where the header would actually save real work.

**Confidence:** high.

---

## Tags become per-user, not global

**Date:** 16/09/2026

**Context:** `tag` had a single global `unique(name)` constraint: one "vegan" tag, shared
by whoever used it. With real separate accounts, one user's custom tag showing up in
another user's autocomplete dropdown is a real data leak (it names, at minimum, that a
tag with that word exists), not just an odd UX wrinkle.

**Options I considered:**
- Leave tags global, shared across all accounts, cheap and simple.
- Scope tags per-user: add `ownerId`, change the unique constraint to `(ownerId, name)`.

**Chose:** per-user tags.

**Why:** a tag is really shorthand the person who created it uses to organise their own
recipes, not a shared taxonomy anyone agreed on. Two people independently having a
"vegan" tag isn't a collision to dedupe, it's two unrelated facts that happen to use the
same word. The cost is small: one added column, one composite unique constraint instead
of a bare one, and `setRecipeTags`'s upsert/lookup now filters by `ownerId` too.

**What I'd revisit this under:** a household/shared-collection mode, if that ever gets
built on top of this (explicitly ruled out for the account model itself, see the
multi-user plan), shared tags might make sense scoped to the household instead of the
individual account.

**Confidence:** high.

---

## bcrypt for password hashing, not sha256Hex

**Date:** 16/09/2026

**Context:** Real accounts need a password stored in a way that survives a leaked `user`
table. The codebase already has `sha256Hex`, used for hashing session tokens and,
previously, the single shared `APP_PASSWORD`.

**Options I considered:**
- `sha256Hex` (already in the codebase): fast, unsalted, general-purpose hash.
- `crypto.scrypt` (Node built-in, no dependency): adaptive, salted, memory-hard.
- bcrypt-family (`bcryptjs`, pure JS, or native `bcrypt`): adaptive, salted, the
  long-standing default for password storage.
- Argon2: newer, generally considered the strongest current choice, less battle-tested
  tooling in the JS ecosystem than bcrypt.

**Chose:** `bcryptjs`.

**Why:** `sha256Hex` was fine for a session token (256 bits of fresh randomness, nothing
to guess) and was fine-ish for the old `APP_PASSWORD` (a 150-bit machine-generated
string, see the login-rate-limiting entry above), but a human-chosen account password is
exactly the case a fast, unsalted hash is bad at: a leaked table lets an attacker hash a
big password list once and compare against every row. bcrypt is salted per-hash (two
people with the same password get different hashes) and deliberately slow, so that
offline attack gets expensive per-guess instead of being one bulk hash-and-compare pass.
Chose `bcryptjs` over native `bcrypt` specifically for serverless: no native binary to
compile or ship, which matters for Vercel's cold starts; chose it over `crypto.scrypt`
(which would've added zero dependencies) because bcrypt's compare function is a single
call with the work factor baked into the stored hash string, `scrypt` needs the caller to
manage and store its own cost parameters and salt correctly, more to get wrong by hand.

**What I'd revisit this under:** a security review flagging bcrypt's 72-byte password
truncation as a real problem here (it isn't, at signup's 8-character minimum), or wanting
Argon2's stronger guarantees enough to pull in `argon2` and its native binary.

**Confidence:** high.

---

## Real multi-user accounts, hand-rolled again, not Auth.js

**Date:** 16/09/2026

**Context:** the "Password auth in proxy.ts" entry below predicted its own reversal
condition explicitly: "a second user... flips it entirely... At that point it's Auth.js,
not a bigger password." That condition is now true, the app is growing real per-account
data isolation. Worth actually confronting that prediction rather than quietly not doing
it.

**Options I considered:**
- Auth.js (NextAuth): the standard Next.js auth library, session/JWT strategies, OAuth
  providers, credentials provider for email+password, adapter for Drizzle.
- Clerk / Lucia / Supabase Auth: hosted or lighter-weight alternatives, similar tradeoffs.
- Extend the existing hand-rolled session system: add a `user` table, bcrypt the
  password, add `userId` to `session`, keep everything else (the cookie, the SHA-256
  session-id hashing, the `proxy.ts` gate shape) as-is.

**Chose:** extend the hand-rolled system.

**Why:** the earlier entry's reasoning for the shared password was "nothing a real auth
system's features would do here", and that's now only half true: real accounts are
needed, but nothing else Auth.js brings (OAuth providers, JWT strategies, email
verification flows, a plugin adapter layer) is. The session mechanics this project
already built and understands (opaque token, SHA-256'd before storage, a `session` table
row per login, `proxy.ts` checking it) don't change shape at all when a second user
shows up, they just gain a `userId` column. Swapping to Auth.js here would mean learning
its adapter/provider/callback model instead of extending code I already wrote and can
explain line by line, which is the whole point of this project per the rule at the top
of this file. The actual new surface area, real ownership checks in the data layer, is
identical either way: Auth.js doesn't know which rows in `recipe` belong to which user,
that has to be hand-written regardless of what issues the session.

**What I'd revisit this under:** wanting social login (Google/GitHub sign-in), email
verification, or password reset flows, all genuinely nontrivial to hand-roll correctly
and exactly what a library like Auth.js earns its keep on. None of those are in scope
yet.

**Confidence:** high on the reasoning, medium on how long "just extend it" keeps holding
as more auth features get requested.

---

## No login rate limiting, despite the finding

**Date:** 16/09/2026

**Context:** A whole-codebase security review flagged `login` as having no rate limit,
delay, or lockout on repeated failed attempts, so `APP_PASSWORD` could in principle be
brute-forced online with no backoff anywhere in the request path.

**Options I considered:**
- A fixed delay after a wrong attempt (a few hundred milliseconds), cheap, one line.
- A real rate limiter, per-IP or per-cookie attempt counting with a cooldown or lockout,
  a genuine feature with its own storage and edge cases (what resets it, what happens to
  me if I trip my own lockout).
- Do nothing, document why.

**Chose:** do nothing, document why, same treatment as the SSRF gap (Q24).

**Why:** `APP_PASSWORD` is a 25-character machine-generated string spanning upper and
lower case letters, digits, and a symbol, on the order of 150 bits of entropy. No realistic
request rate, rate-limited or not, brings brute-forcing that within reach; a delay or
lockout here would be defense-in-depth for a threat that isn't actually reachable given
the password's own strength, not a fix for a real exposure. Building a real rate limiter
would be solving a problem this specific setup doesn't have, the same reasoning that kept
SSRF unfixed: single-user, low realistic risk, and worth naming explicitly rather than
leaving unaddressed and unexplained.

**What I did fix in the same pass, because it was free:** switched the password comparison
itself from `!==` to a constant-time compare (`timingSafeEqual` in `auth.ts`). That one has
no cost and no tradeoff to weigh, so it's not in the same category as the rate-limiting
question, it just wasn't done originally for no real reason.

**What I'd revisit this under:** a weaker or user-chosen password (this reasoning is
specific to a long machine-generated one), or a second user, at which point real auth
(Q22's Auth.js answer) replaces this whole model anyway.

**Confidence:** high. The math on the password's entropy is straightforward, and this is
the same honest-tradeoff shape as the SSRF and shared-test-database gaps already
documented elsewhere in this file.

**Update, 16/09/2026:** both conditions in "what I'd revisit this under" are now true.
Real accounts exist (see "Real multi-user accounts" above) with an 8-character minimum,
user-chosen password, nowhere near the old `APP_PASSWORD`'s ~150 bits, and there's a real
second user now, in principle. The entropy argument this entry's "no" rested on no longer
holds; the gap is more real than it was. Still deliberately not fixed in this pass (Phase
1 was scoped to accounts existing at all, not hardening login itself), but it's now a
correctly-updated known gap rather than a stale one: worth revisiting properly (a fixed
post-failure delay is the cheap first move) before this app has data worth someone
actually trying to brute-force into.

---

## Cutting Instagram capture

**Date:** 15/09/2026

**Context:** `captureFromInstagramUrl` existed from day 7, a best-effort oEmbed call
expected to fail often (see "Recipe capture: server-side fetch, JSON-LD, oEmbed, and a
fallback ladder"). Revisiting whether it was worth keeping.

**Why cut it, not just leave it:** the premise doesn't hold up. Instagram is a mobile-app
product; recipes found there get saved inside Instagram's own save feature, not copied out
as a URL and pasted into a browser form. The "paste an Instagram link" flow this app
offered was solving a problem that doesn't really happen: by the time someone has a URL to
paste into a web form, they've already left the context (the mobile app, mid-scroll) where
Instagram recipes actually get found. Pair that with oEmbed being expected to fail most of
the time anyway, and the second rung of the fallback ladder was real code (a function, a
hostname check, tests, a form placeholder mentioning it) earning very little.

**What changed:** `captureFromInstagramUrl` and `isInstagramUrl` removed from
`app/lib/capture.ts`. `importFromUrl` always uses the web parser now. The `sourceType`
column keeps `'instagram'` as a possible value only for old rows already saved with it,
not because a migration was needed, it's a plain `text` column, no CHECK constraint.

**What I'd revisit this under:** if this ever became a shared or mobile-first tool where
"save the app straight from Instagram" was a real interaction, not a hypothetical one.

**Confidence:** high. This is a scope cut with a clear reason, not a bug fix, and it
shrinks the fallback ladder to something that's fully earning its complexity: JSON-LD,
then paste it yourself.

---

## Photo uploads: Vercel Blob, client-direct, via a Route Handler

**Date:** 11/09/2026

**Context:** Wanted an actual drag-and-drop photo gallery on the detail page, not another
paste-a-URL field. That means real file storage, something this app has never needed before.

**Options I considered:**
- **Multiple pasted URLs instead of real uploads**: zero new infrastructure, but isn't what
  was asked for, still just linking to photos hosted somewhere else.
- **Store files in Postgres** (bytea column): no new service, but Neon isn't built for
  serving binary blobs and this is exactly the wrong tool, cheapest to set up, worst fit.
- **Vercel Blob**: pairs natively with Vercel hosting, a small SDK, free at this app's scale
  (checked the actual numbers: 5GB storage / 100GB transfer per month on the free Hobby
  tier, thousands of photos' worth for a personal collection).

**Chose:** Vercel Blob, uploaded **client-direct** (browser straight to Blob storage) via a
Route Handler that only mints a short-lived upload token, not a Server Action that receives
the file itself.

**Why client-direct over a Server Action:** a Server Action has a request body size limit
(1MB by default); phone photos routinely exceed that. Client-direct upload means the file
never passes through a serverless function at all, so there's no size ceiling to configure
or hit. It's also a genuine, correctly-motivated use of a Route Handler rather than a Server
Action, the caller here is `@vercel/blob/client`'s browser SDK, not this app's own UI, which
is exactly the "when you'd need a Route Handler" case from the Server-Actions-vs-Route-
Handlers decision.

**Why no `onUploadCompleted` webhook:** `@vercel/blob/client`'s recommended pattern includes
an optional webhook Vercel calls back once the upload finishes, useful if the browser might
disconnect mid-upload. I skipped it: it needs a publicly reachable callback URL, which can't
reach `localhost` during local dev, so relying on it would mean the feature silently doesn't
work until deployed. Instead, the client calls a Server Action directly once its own
`upload()` promise resolves, same direct-invoke pattern already used for
`toggleWantToMake`/`setRating`. Simpler, and it actually works locally.

**Why a separate `recipe_image` table, not replacing `recipe.imageUrl`:** the card grid
already reads `imageUrl` as a single cover image; keeping it separate meant this feature
touched none of that, no risk to the list page. Uploading a gallery photo doesn't
automatically become the cover, that's still an explicit "Image URL" field edit. A bit of
duplication (two ways to attach an image to a recipe) in exchange for a much smaller,
lower-risk change.

**What I'd revisit this under:** if "set as cover" from the gallery turns out to be wanted
enough to be worth the extra wiring, or if upload volume ever approached the Hobby free-tier
limits (it won't, for a personal collection).

**Confidence:** high. Verified end to end, 12/09: a real `upload()` call through
`/api/upload`, into Blob storage, `addRecipeImage`'s exact DB write, then confirmed rendered
on the detail page, then deleted (blob + row) and confirmed both gone. One real snag along
the way: the first Blob store got created as **private** by default, and `access: "public"`
(needed since photos render as plain `<img src>`, no per-request auth) isn't allowed against
a private store, and unlike most store settings this one **can't be changed after creation**
(confirmed against Vercel's docs), so had to delete that store and create a new one as public.
Worth remembering for next time: pick the access mode deliberately at creation, it's a
one-way door.

---

## Pulling the want-to-make marker, no replacement yet

**Date:** 11/09/2026

**Context:** The list redesign (wider grid, flat cards) removed the corner star button that
toggled "want to make" on each card. It didn't come out of a bug or a real problem with the
old marker, it came out of not having a clear answer for what it should look like in a
flatter, wider, more image-forward grid, the old circular star-over-photo button was
designed for the previous denser 3-column card, and a photo-overlay button reads as visual
noise here, especially sitting next to the 1-5 rating stars it could be confused with.

**Options I considered:**
- Keep the old overlay button as-is: fastest, but it's the thing that doesn't fit the new
  design, keeping it would mean shipping a redesign with one deliberately unaddressed piece.
- Guess at a replacement now (a badge, a corner ribbon, a checkmark): possible, but I don't
  have a real opinion yet on whether "want to make" should even be a per-card marker at all,
  versus, say, a filter/view instead of a visible badge on every card.
- Remove it from the card entirely, keep the underlying feature (the `toggleWantToMake`
  action, the `wantToMake` column, the detail-page toggle) untouched, and treat "what the
  marker looks like" as its own open question.

**Chose:** remove it from the cards, keep everything else.

**Why:** shipping "no marker yet" is more honest than shipping a guess I'd likely redo. The
data model and the Server Action didn't need to change at all, this is purely a display
decision, which is exactly the kind of thing that's cheap to defer and expensive to get
wrong twice.

**What I'd revisit this under:** once there's an actual opinion on the interaction, options
range from a small corner badge to a dedicated "want to make" filter view (parallel to the
tag filter) instead of a per-card marker at all.

**Confidence:** medium-high on "removing it beats guessing", low on what actually replaces
it, that's the open question, tracked in IDEAS.md, not this entry.

---

## Real sessions, not a static cookie

**Date:** 11/09/2026

**Context:** The auth cookie held `SHA-256(APP_PASSWORD)`, a single fixed value with no
server-side record of who's signed in or from where. It came out of writing the honest Q20
interview answer: every device that ever logged in holds the identical cookie value forever,
there's no way to revoke one without changing the shared password (which revokes every
device at once), and there's no expiry beyond the cookie's own `maxAge`.

**Options I considered:**
- Leave it: defensible for a single-user toy, and I'd already named it as a deliberate,
  understood tradeoff (Q20).
- Full auth library (Auth.js/Lucia): real identity, per-account hashing, the library owns
  sessions. Rejected as scope creep against this project's own line, single-user was a
  deliberate simplification (Q3), and this is what I'd reach for the day there's a second
  user (Q22), not before.
- Server-side sessions, still one shared password: a `session` table holding
  `SHA-256(token) → expiresAt`; login issues a random token, puts the raw token in the
  cookie, stores only its hash. `proxy.ts` looks the hashed cookie up on every request.

**Chose:** server-side sessions, one shared password unchanged.

**Why:** it fixes the actual, specific gap, revocation and expiry, without changing what the
app's auth *model* is. The password check, the single-user framing, and `proxy.ts` as the
one enforcement point are all untouched. Storing the token's hash rather than the raw token
mirrors the reasoning that already justified digesting the password (Q19): a leaked `session`
table can't be replayed into a live cookie.

**What I gave up:** `proxy.ts` now does a DB read on every request, previously it was pure
hash comparison, zero I/O. That's a real cost, but it's the same posture the rest of the app
already takes (`force-dynamic`, every page queries Postgres on every view), so it's
consistent rather than a new kind of tradeoff. Expired rows are only swept lazily, on the
next request that presents that exact expired cookie, so a session nobody ever revisits with
its old cookie lingers in the table until something bothers to clean it up. No scheduled
sweep, and no "sign out everywhere" button, though the latter would just be
`db.delete(sessions)` if I wanted it later.

**What I'd revisit this under:** a second real user (then it's Auth.js, per Q22), or if the
per-request DB read in `proxy.ts` ever showed up as a real latency cost.

**Confidence:** high. Migration applied, exercised end to end (via curl, real form POST
including the `$ACTION_ID_...` field Next embeds for a no-JS-capable Server Action form,
not a shortcut): login sets a real session cookie, `/` and a recipe detail page both render
with it, logout deletes the row and re-gates immediately. 11/09.

---

## Migrations run on the production build, not by hand

**Date:** 11/09/2026

**Context:** `db:migrate` was a step I ran locally, against the one shared Neon connection
string, whenever the schema changed. It worked (see the `rating` column, migration
`0001_wet_callisto`) only because there's a single Neon database and I remembered to run it.
Vercel's own build never touches the database, deploying new code and migrating the schema
are two unrelated actions that happened to both be "things I do after changing the schema."
Came out of writing the Q18 interview answer and not liking the honest version of it.

**Options I considered:**
- Keep it manual: cheapest, but silent-failure risk if I forget, and it's the actual gap the
  interview question is pointing at.
- A GitHub Actions step on push to `main` that runs `db:migrate`: reuses the `DATABASE_URL`
  secret already in CI for e2e. Problem: it's not ordered against Vercel's own git-triggered
  deploy, both fire independently off the same push, so it doesn't actually gate anything,
  the deploy can go live before or after the migration finishes.
- Run migrations inside the Vercel build itself, via the `vercel-build` package.json
  convention (Vercel uses that script instead of `build` when it's present), gated to only
  run on production builds.

**Chose:** the `vercel-build` script, gated on `VERCEL_ENV === "production"`.

**Why:** it's the only option that actually orders the two steps, migrate then build then
deploy, in the same process, so a failed migration fails the build and the bad deploy never
goes live. Gating on `VERCEL_ENV` matters because preview deployments (every branch push,
every PR) would otherwise run `db:migrate` against the single shared production database on
every preview build, since this project has no per-branch database. No extra secrets needed:
`DATABASE_URL` is already a Vercel project env var.

**What I'd revisit this under:** adding a real staging database (Neon branching would give
one per PR for free), at which point I'd want preview builds to migrate *their own* branch
DB rather than skip migrating entirely, and I'd drop the `VERCEL_ENV` gate.

**Confidence:** medium. The build-gating logic is sound and I can defend it, but it's
**not yet verified against a real Vercel build** with a pending migration, that only happens
on the next push to `main`. Less sure about the shell conditional's portability if Vercel
ever changes its build image; a small Node script would be more robust than inline
`if [ ... ]` and is the obvious next iteration if this gets more elaborate.

---

## Error handling: three layers, not one catch-all

**Date:** 07/09/2026

**Context:** Nothing handled failure. A form action threw `new Error("Title is required")`,
which Next turned into a full-page crash that wiped whatever the user had typed. A database
blip on the list page showed the raw Next error overlay. `getRecipeById` quietly turned any
DB error into a "recipe not found". I wanted a real message for each failure, near the thing
that failed.

**Options I considered:**
- One global `error.tsx` and let everything bubble to it
- A toast library for everything, including form validation
- Split by failure type: framework boundary for unexpected throws, `useActionState` for
  form saves, toasts for the optimistic buttons

**Chose:** split by failure type.

**Why:** the three failures are genuinely different and a single mechanism handles one of
them badly.
- **Unexpected render throw** (DB down mid-page-load): this is what `error.tsx` /
  `global-error.tsx` exist for. It gives a "Try again" that re-runs the segment. I also
  stopped `getRecipeById` swallowing DB errors, so an outage looks like an outage, not a
  404; only a malformed uuid is a real "not found".
- **Form save failure** (empty title, or the write fails): throwing here is user-hostile,
  it discards the form. `useActionState` lets the action `return { error }` instead, the
  form stays mounted with its values, the message shows inline above the button.
  `useFormStatus` gives the pending state for free. Still works with JS off (full-page POST,
  message rendered on the response).
- **Optimistic action failure** (rating, want-to-make, delete): the UI already moved. There
  is no form to annotate and no page to replace, so a toast is the honest fit. `useOptimistic`
  rolls the value back on its own; the toast just says why.

**Cost:** three patterns to keep straight instead of one, plus `sonner` as a dependency
(small, and the shadcn wrapper is in the repo). A confirm-on-delete came along with making
the delete button a client component.

**What I'd revisit this under:** if a design system with a real modal/dialog gets added, the
`confirm()` on delete should move to that. If forms grew field-level validation, the single
`error` string would need to become a per-field shape.

**Confidence:** high on the split. Medium on `error.tsx` copy tone; it is deliberately vague
about the cause because the user can't act on "NeonDbError".

---

## Testing: Vitest for units, Playwright for the Server-Component flows

**Date:** 07/09/2026

**Context:** The project had no tests. For an exercise about getting hands-on with a stack,
that's the obvious gap. I already use Vitest for React, so the real question was whether a
second tool for end-to-end was worth it given there are no complicated user flows.

**Options I considered:**
- Vitest only: unit and component tests, skip end-to-end
- Vitest + Playwright: units in Vitest, full flows in a real browser
- Add Jest or Cypress instead: the older equivalents

**Chose:** Vitest plus Playwright.

**Why:** Vitest cannot render `async` Server Components (Next's own docs say to use E2E for
those), and Server Components plus Server Actions are the whole point of this project. So a
unit-only suite would test the pure helpers and the client components but none of the thing
I actually built. Playwright is the only way to exercise a page rendering from the database
and a form triggering a Server Action and a redirect, together. The flows being simple is
not a reason to skip it, the value is in testing the *integration*, not the flow. Jest and
Cypress would each be a step backwards from tools I already use or that have clearly won.

**What gets tested where:**
- Vitest: `capture.ts` JSON-LD parsing (it had real bugs), `auth.ts` digest,
  `tagColorClasses`, and the client components (`RowsEditor`, `TagInput`, the toggle, the
  rating). 34 tests.
- Playwright: the auth gate, add / view / edit / delete a recipe, live search. Runs against
  a production build (`next build && next start`, no dev-compile flake) and hits the real
  dev database. Every test names its data `e2e-...` and a global teardown deletes anything
  matching, so a crashed run leaves at most one stray recipe.

**On the test database:** ideally E2E gets a dedicated Neon branch. It doesn't yet, because
the `neon-http` driver can't talk to a local Postgres and setting up a branch is a manual
step I skipped for now. The prefix-and-teardown approach is the pragmatic version and it is
safe enough for a solo app. This is the weakest part of the setup and the first thing I'd
harden.

**What I'd revisit this under:** a genuinely complex multi-step flow would need deliberate
Playwright coverage rather than smoke tests. A middle layer is also missing: integration
tests of the Server Actions against a test database, between the unit and E2E layers.

**Confidence:** high on the tool split (Vitest can't do async Server Components, so
Playwright isn't optional). Medium on the test-DB approach, as above.

---

## Ingredient and step editing: one row per item, not a textarea

**Date:** 07/09/2026

**Context:** The add and edit forms had a single tall textarea each for ingredients and
steps. It works, but it gives no structure and no guidance, and nothing stops a stray blank
line or a pasted blob. Recipe apps (NYT Cooking's editor, Whisk, Tandoor) present each item
as its own row.

**Options I considered:**
- Keep the textarea, one item per line by convention
- One `<input>` per item, with add / remove buttons and a per-item placeholder

**Chose:** the row editor.

**Why:** it makes the shape explicit (this many ingredients, this many steps), the first row
carries a real example as a placeholder, steps are numbered as you type, and blank rows
can't sneak into the data. The DB doesn't change: `ingredients` and `steps` are still `text`
columns. Each row is an `<input name="ingredient">`, the Server Action reads them with
`formData.getAll("ingredient")`, trims, drops blanks, and joins with newlines, so storage
and the detail page are untouched.

The cost: add / remove is dynamic form state, so `RowsEditor` is a Client Component (the
app's third). It still degrades: without JS the existing rows render and submit, you just
can't add or remove.

**What I'd revisit this under:** wanting drag-to-reorder (needs a dnd library), ingredient
section headers ("For the sauce"), or treating an ingredient as structured data (quantity /
unit / name), which is project 2's territory.

**Confidence:** high.

---

## Live debounced search, still URL-backed

**Date:** 06/09/2026

**Context:** The search box was a plain GET form: type, press Enter, navigate. I wanted it to
filter live on each keystroke instead. The earlier "URL as filter state" entry predicted
this and said the URL should stay in sync rather than be dropped.

**Options I considered:**
- Keep the GET form (no client JS, but no live results)
- Client component holding the query in `useState`, filtering the list in the browser
- Client component that updates the URL (`router.replace`) on a debounced keystroke, server
  re-renders the filtered list

**Chose:** the third: a debounced client component that writes to the URL.

**Why:** live typing needs browser state, so this is the app's second `"use client"`
component, and it passes the same test the want-to-make toggle did (a per-interaction delay
a user would notice). But the filtering itself stays on the server against the database, and
the query stays in the URL, so a search is still shareable and the back button still works.
`router.replace` rather than `push` so a burst of keystrokes doesn't flood browser history.
A 250ms debounce so it's not a request per character. The plain GET form is kept as the
no-JS fallback (Enter still works).

**What I'd revisit this under:** the recipe list getting large enough that a server round
trip per debounced keystroke feels slow, at which point client-side filtering of an
already-loaded list, or an index like the semantic search idea, becomes worth it.

**Confidence:** high.

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

**Follow-up (07/09/2026):** theming it took three passes. First "warm paper + terracotta"
with a Fraunces serif, then "fresh market" with herb green, both still read as the current
"AI-generated" default: low chroma, warm-tinted whites, an editorial serif. What landed:
a cool near-white ground with zero warmth, a vivid magenta primary and an orange (the two
ends of the Instagram gradient), a `.text-brand` gradient on the app title, and Bricolage
Grotesque for headings. The recipe list also became an image-forward card grid rather than
a text list. The palette is CSS variables only; the grid was a real layout change.

**Confidence:** high on the library. The lesson from the three attempts: a timid palette
reads as no palette, and "modern" here meant committing to saturation and to imagery, not
just picking a nicer neutral.

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
