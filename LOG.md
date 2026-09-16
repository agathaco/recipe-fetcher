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

## Day 10: auth gate

- `proxy.ts` at the root (Next 16's rename of `middleware.ts`): checks an `rf_auth` cookie
  against the SHA-256 digest of `APP_PASSWORD`, redirects to `/login?from=...` if it's wrong
  or missing. `config.matcher` excludes `/login` and Next internals. No password configured
  means the gate is off (local dev default).
- `app/lib/auth.ts`: cookie name plus a Web-Crypto digest helper, written to run in both the
  Edge proxy and the Node login action.
- `login` / `logout` Server Actions in `app/lib/actions.ts`: `login` compares the password,
  sets an httpOnly cookie holding the digest (not the password), redirects to `from`.
  `logout` deletes the cookie.
- `app/login/page.tsx`: password form. "Sign out" button added to the list page header.
- `.env.local` now has `APP_PASSWORD=letmein` for local testing; Vercel needs the real one.
- Verified end to end with curl: unauthed redirect, wrong password, right password sets the
  correct digest cookie, authed access works, logout clears it and re-gates.
- **Taught:** proxy/middleware as the place for a cheap pre-request check, the Edge runtime's
  no-Node-APIs constraint, `cookies()` inside a Server Action, why the cookie holds a digest
  rather than the secret.
- Deferred: the polish pass (empty states are mostly there, responsive is fine, favicon is
  still the scaffold default).

## UI pass (post-day-10)

- Adopted **shadcn/ui** (DECISIONS entry written): `init` + button, input, textarea, label,
  card, badge, checkbox. This variant is built on Base UI, not Radix; `cn` comes from the
  `cn` package, components live in `components/ui/`.
- Rebuilt every page with it: `components/recipe-fields.tsx` shared by add + edit forms,
  cards and proper spacing throughout, tag/toggle as badges, recipe images now shown on the
  list and detail (`imageUrl` was stored but never rendered), steps rendered as a numbered
  list instead of a text blob.
- Fixed the filter-to-filter width jump (`scrollbar-gutter: stable`).
- Fixed `&amp;` showing literally in imported titles (decode HTML entities in `capture.ts`).
- Font: shadcn's theme maps `font-sans` to `--font-sans`, so `app/layout.tsx` now names the
  Geist variable `--font-sans`.
- Verified: build/lint/typecheck clean, all pages render, the Base UI checkbox still submits
  `wantToMake=on` correctly through the edit form.
- Backlog in `IDEAS.md`: AI features (auto-tag, semantic search, caption parsing), search
  debounce, dark mode, more.
- **Theming:** stock zinc looked too generic for a recipe app. Themed it via CSS variables
  only. First attempt was "warm paper + terracotta" + Fraunces, which still read too
  "AI-default" (low chroma, sepia, editorial serif). Second attempt (07/09): "fresh market",
  herb-green primary, amber accent, cleaner near-white, higher chroma, Bricolage Grotesque
  for headings. Favicon recoloured to match. `.dark` tokens updated too but no toggle yet.
  DECISIONS entry has both follow-ups.
- **Favicon:** replaced the scaffold `app/favicon.ico` with `app/icon.svg`, a whisk on a
  terracotta square. Next's `app/icon.svg` file convention injects the `<link>` automatically.
- **Live search:** `app/components/search-box.tsx`, the app's 2nd Client Component. Debounced
  (250ms) `router.replace` on each keystroke, so the list filters live but the query stays in
  the URL and the DB still does the filtering. Plain GET form kept as the no-JS fallback.
  DECISIONS entry written. Spinner in the input during the transition.
- **Image URL field:** was only settable via import; now a visible field in the shared form
  (`components/recipe-fields.tsx`), with a preview, saved on both create and edit.
- **Row-based ingredient/step editing:** the two big textareas replaced with
  `components/rows-editor.tsx` (3rd Client Component): one input per item, add/remove
  buttons, per-item placeholder, numbered steps. Server Action reads `formData.getAll()`
  and joins with newlines, so the `text` columns and the detail page are unchanged. Form
  regrouped into cards (Recipe / Ingredients / Steps / Notes and links). DECISIONS entry
  written. Drew on NYT Cooking / Whisk / Tandoor editors (Paprika itself is textarea-based).
- **UI v3 (07/09):** the fresh-market theme still wasn't it. Now: cool near-white background
  (no warm tint at all), vivid magenta primary + orange, a `.text-brand` gradient (Instagram
  style) on the app title, radius bumped to 0.9rem. The recipe list is now a **card grid**
  (`sm:grid-cols-2 lg:grid-cols-3`), image-forward, 4:3 hero, `UtensilsCrossed` placeholder
  when there's no image, and the want-to-make star as a circular overlay in the card corner
  (new `compact` prop on the toggle). Favicon is now a purple/pink/orange gradient.

## Ratings + palette v4 (07/09)

- **Colours shifted off the literal Instagram values** and away from orange: primary is now
  a fuchsia-magenta (hue ~328), the `.text-brand` gradient runs violet to fuchsia to pink,
  and the want-to-make toggle uses the primary purple instead of amber. Favicon gradient
  matched.
- **Card titles:** bigger (`text-[15px] font-semibold`) with more space above them.
- **Star ratings:** new nullable `rating` integer column on `recipe` (migration
  `0001_wet_callisto`). `setRating(id, n)` Server Action (direct-invoke, like
  `toggleWantToMake`). `app/components/rating-stars.tsx` is a Client Component with hover
  preview and optimistic update on the detail page; `components/star-row.tsx` is the
  read-only display on list cards. Click the current rating again to clear it.

## Tag combobox + coloured pills (07/09)

- `components/tag-pill.tsx`: `tagColorClasses(name)` hashes a tag name to one of 8 fixed
  colour classes, so a tag is the same colour everywhere. `<TagPill>` for read-only display.
- `app/components/tag-input.tsx` (5th "use client" component): the recipe form's tag field is
  now a combobox. Selected tags are removable coloured pills inside the box, a dropdown below
  lists existing tags and filters as you type, a "Create ..." row appears for a new name,
  keyboard nav (arrows / Enter / Backspace-to-remove-last / Esc). Each selected tag is a
  hidden `<input name="tag">`; `setRecipeTags` now takes `string[]` from `formData.getAll`.
- Card tags, detail-page tags, and the filter row all render as the coloured pills now.
  Detail + filter pills stay links. Removed the leftover `test` and unused `soup` tags.
- Tested: existing tags pre-select on edit, create/dedup/lowercase on submit, new categories
  are created. The dropdown interaction itself needs a browser.

## Tests (07/09)

- **Vitest + RTL** (`@vitejs/plugin-react-swc`, jsdom, native tsconfig-paths): 34 unit /
  component tests. `capture.ts` parsing (the code with real bugs), `auth.ts` digest,
  `tagColorClasses`, and the client components (`RowsEditor`, `TagInput`, `WantToMakeToggle`,
  `RatingStars`, the last two with the Server Action mocked). `npm test` / `npm run test:run`.
- **Playwright** (`channel: "chrome"`, because bundled Chromium needs macOS 13+): 4 E2E specs
  against a production build. Auth gate + login; add / view / edit / delete a recipe; live
  search. Data is prefixed `e2e-` and a global teardown deletes it. `npm run test:e2e`.
- **CI** (`.github/workflows/ci.yml`): a `unit` job (lint + typecheck + Vitest, no secrets)
  and an `e2e` job (Playwright, needs `DATABASE_URL` and `APP_PASSWORD` repo secrets).
- Decided on Vitest + Playwright rather than Vitest alone: Next's own docs say `async` Server
  Components can't be unit tested, and those are the point of the project. DECISIONS entry
  written; the shared test DB is flagged as the weak spot.

## Code review + cleanup pass (07/09)

- **Open redirect in `login`**: `?from=` was passed straight to `redirect()`, so
  `/login?from=//evil.com` bounced off-site. Now only same-origin paths pass
  (`from.startsWith("/") && !from.startsWith("//")`), else `/`.
- **Detail page queried the DB twice**: `generateMetadata` and the page body both
  call `getRecipeById`. Wrapped it in `React.cache` so it's one query per request.
- **Proxy matcher** now also excludes `/icon.svg` (was being auth-gated).
- **`importFromUrl`** no longer redirects to a bare `/recipes/new?` when nothing
  was captured.
- **Capture fetches** got an 8s `AbortSignal.timeout` so a slow site can't hang the
  action.
- **`field()` searchParams helper** was copy-pasted in two pages; extracted to
  `app/lib/params.ts` as `param()`.
- **Dropped `Geist_Mono`**: loaded in the layout and wired to `--font-mono` but
  never used. Removed the font, the CSS variable, and the leftover `flex flex-col`
  on `<body>`.
- Left for a later pass: SSRF in `captureFromWebUrl`, no `error.tsx` boundary, no
  CHECK constraint on `rating`, `TagInput` missing full ARIA combobox roles.

## Error handling (07/09)

- **`app/error.tsx`** (route error boundary) + **`app/global-error.tsx`** (root-layout
  boundary): a render throw now shows a "Something went wrong / Try again" card instead of
  the raw Next overlay. `getRecipeById` no longer catches DB errors, so an outage reaches
  the boundary instead of masquerading as a 404; a malformed uuid is still a plain 404.
- **Forms**: `createRecipe` / `updateRecipe` return a `FormState` (`{ error? }`) instead of
  throwing. New `components/recipe-form.tsx` (client) wraps `RecipeFields` with
  `useActionState` + `useFormStatus` so a failed save shows inline and keeps the typed
  values. The new and edit pages now render `<RecipeForm>` instead of a raw `<form>`.
- **Optimistic actions**: `rating-stars`, `want-to-make-toggle`, and a new
  `delete-recipe-button` (client, with a `confirm()`) catch a rejected action and show a
  `sonner` toast. `<Toaster>` mounted once in the layout. Added `sonner` via shadcn, removed
  the `next-themes` dep it pulled in (no theme switching here) and trimmed its wrapper.
- Tests: `components/recipe-form.test.tsx` (inline error path), plus a failure-path case in
  `rating-stars.test.tsx`. 37 passing.
- DECISIONS.md: "Error handling: three layers, not one catch-all". ARCHITECTURE.md: new
  "Error handling" section + touchpoint rows.

## force-dynamic hoisted to the layout (07/09)

- Was `export const dynamic = "force-dynamic"` in all 5 page files; now one copy in
  `app/layout.tsx`, which cascades to every route. Same behavior (build output still shows
  every route as `ƒ`), less repetition, nothing to keep in sync. ARCHITECTURE.md updated.

## setRecipeTags rewritten as an atomic diff (08/09)

- Was: delete every `recipe_tag` row for the recipe, then re-insert the whole set in a loop
  with one `INSERT` per tag. Three problems: N+1, a brief window where the recipe had no
  tags, and no atomicity (neon-http runs single statements, so a mid-loop failure left a
  partial set).
- Now: bulk-upsert the tag names (one statement), read their ids back (one `SELECT ... IN`),
  then `db.batch([delete stale links, insert new links])`. Neon runs a batch as one
  transaction. Unchanged links are never touched, so no empty window; round trips are fixed
  at 3 regardless of tag count.
- E2E `recipes.spec.ts` now swaps a tag on the edit step (remove one, add one) to exercise
  the diff. All tests green.
- Came out of interview-prep Q12/Q16. Updated both answers.

## Migrations run on the production build (11/09)

- `package.json`: new `vercel-build` script. Vercel uses that instead of `build` when it's
  present. Runs `db:migrate` first, but only when `$VERCEL_ENV = production` (unset locally
  and on preview deploys), then `next build`. A failed migration now fails the build, so a
  bad deploy never goes live.
- Replaces the manual step (`npm run db:migrate` run by hand against the shared connection
  string) that got the `rating` column into production. Considered a GitHub Actions step
  instead; rejected because it fires independently of Vercel's own git-triggered deploy and
  so can't actually gate anything.
- Verified locally: `npm run vercel-build` with no `VERCEL_ENV` set (matches local/preview)
  skips `db:migrate` and runs a clean production build. The production-gated branch
  (`db:migrate` actually running) is unverified in this pass, first real test is the next
  push to `main`.
- Came out of writing the honest Q18 interview answer. ARCHITECTURE.md ("How it maps to
  Vercel") and DECISIONS.md updated.

## Real sessions replace the static auth cookie (11/09)

- New `session` table: `id` (SHA-256 hex of a random token), `createdAt`, `expiresAt`.
  Migration `0002_hard_tyger_tiger.sql` generated.
- `app/lib/auth.ts`: dropped `expectedAuthCookie` (the static-digest helper), added
  `randomToken()` (32 random bytes via `crypto.getRandomValues`, hex) and `sessionId()`
  (SHA-256 of a token, same helper reused).
- `login`: still checks the one shared `APP_PASSWORD`, but now issues a random token, stores
  its hash in `session` with a 30-day `expiresAt`, and puts the *raw* token (not a hash of
  the password) in the cookie.
- `logout`: deletes this device's `session` row by hashing its cookie value, so only this
  cookie stops working. `proxy.ts`: looks the hashed cookie up in `session` on every request,
  lazily deletes-and-rejects if `expiresAt` has passed.
- `app/lib/auth.test.ts` rewritten for the new helpers. Build/typecheck/lint/unit tests all
  clean (39 passing). E2E auth spec unchanged, it only asserts behavior, not cookie internals.
- Came out of writing the honest Q20 answer. DECISIONS entry: "Real sessions, not a static
  cookie". Q19 and Q20 interview answers rewritten to match.
- Migration applied and curl-verified 12/09, see the closing entry below.

## List redesign: wider grid, flat cards, sort, more tag colours (11/09)

Loosely modelled on a reference layout (fabrx.co/tastebite), adapted rather than copied.

- **Layout:** container widened `max-w-4xl` -> `max-w-6xl`; grid `sm:2/lg:3` ->
  `sm:2/md:3/lg:4` columns, gap bumped to match.
- **Flat cards:** shadcn's base `<Card>` ships `ring-1` and no shadow already; removed the
  `hover:shadow-lg` elevation and overrode the ring to `ring-0` (tailwind-merge, the `cn`
  package, resolves the conflict since `ring-0` comes later in the class string). Separation
  is now purely the grid gap and the image, no card "chrome". Card corner radius `rounded-xl`
  -> `rounded-lg`, tighter internal padding around the title/tags.
- **Removed:** the want-to-make star overlay from the card corner (the `compact` prop and
  branch deleted from `want-to-make-toggle.tsx` entirely, it's unused now). The toggle still
  works on the detail page. No replacement yet, parked in IDEAS.md, not sure what the marker
  should look like.
- **Sort added:** `app/components/sort-select.tsx` (8th `"use client"` component), a plain
  `<select>` inside the same GET form as search so it degrades without JS. `getRecipes` in
  `data.ts` takes a `sort: "date" | "name" | "rating"` and orders in SQL before the
  join/group step. Rating sort needed `NULLS LAST` explicitly (Postgres defaults `DESC` to
  `NULLS FIRST`, which would rank unrated recipes above 5-star ones); Drizzle's `asc()`/
  `desc()` don't expose a nulls option on a plain column (that API is index-definition-only),
  so it's a raw `` sql`...DESC NULLS LAST` `` fragment instead.
- **Tag colours:** `TAG_COLORS` in `tag-pill.tsx` widened from 8 to 14 hues (same hash-to-
  colour scheme, just a bigger palette), skipping plain red/yellow/green since they read too
  close to rose/amber/emerald already in the set.
- Build/typecheck/lint/unit tests (39) all clean. Not browser-verified this session (no
  Chrome tools available, and login was separately blocked until the pending session-table
  migration got applied, see the real-sessions entry above and the closing entry below).
  ARCHITECTURE.md, IDEAS.md updated; the client-component count changed again (seven -> eight),
  INTERVIEW.md Q1/Q27 updated to match.

## Detail page: prep/cook/oven stats, hostname source link, checkable steps (11/09)

- **New columns** on `recipe`: `prepTime`, `cookTime`, `ovenTemp`, all nullable `text`, same
  freeform-not-structured call as `ingredients`/`steps` (migration
  `0003_cold_roland_deschain.sql`). Added to `recipe-fields.tsx` (three inputs in the top
  card) and read by `createRecipe`/`updateRecipe`. Not wired into `capture.ts` yet, JSON-LD
  recipes often carry `prepTime`/`cookTime` as ISO 8601 durations (`PT20M`) which would need
  real parsing, left as a gap for later rather than half-done now.
- **Stat strip** on the detail page: a `bg-primary/10` card showing whichever of prep/cook/
  oven-temp are set, with Clock/Flame/Thermometer icons. Hidden entirely if none are set.
- **Source link** now shows the hostname (`new URL(sourceUrl).hostname`, minus `www.`)
  instead of the literal word "Source" or `Source (sourceType)`.
- **Checkable ingredients and steps**: new `components/recipe-checklist.tsx` (9th
  `"use client"` component). Native checkbox + `<label>` per line (no custom ARIA needed,
  the browser gives it for free), strikethrough when checked. State is `localStorage`,
  keyed `checklist:<recipeId>:ingredients` / `...:steps`, read in a `useEffect` after mount
  rather than during render (localStorage doesn't exist during SSR; reading it any earlier
  would mismatch the server-rendered HTML). Deliberately not in the DB: which step you're on
  is this cooking session's state, not the recipe's, and a stale checked-off state from last
  time would be actively misleading, not useful.
- Build/typecheck/lint/unit tests (39) all clean. ARCHITECTURE.md updated; client-component
  count bumped again (eight -> nine), INTERVIEW.md Q1/Q27 updated to match.

## Photo gallery: real uploads via Vercel Blob (11/09)

- **New table** `recipe_image` (`recipe_id` FK cascade, `url`, `created_at`), one-to-many,
  separate from `recipe.imageUrl` on purpose (migration `0004_orange_mandroid.sql`).
  `getRecipeById` now also pulls `images` via the relational `with`, ordered oldest-first.
- **`@vercel/blob`** added. `app/api/upload/route.ts`: a Route Handler (the app's first)
  implementing `handleUpload`, mints a short-lived client token, restricted to `image/*` and
  10MB. `app/components/photo-gallery.tsx` (10th `"use client"` component): drag-and-drop +
  click-to-browse, calls `@vercel/blob/client`'s `upload()` straight from the browser to
  Blob storage, then the new `addRecipeImage` Server Action to record the URL. Removing a
  photo (`deleteRecipeImage`) calls Blob's `del()` then removes the DB row.
- Deliberately client-direct upload (not a Server Action receiving the file): sidesteps the
  1MB default Server Action body limit entirely, since the file never passes through a
  function. Deliberately skipped `onUploadCompleted` (a webhook that can't reach localhost),
  the client calls `addRecipeImage` itself once its own upload resolves instead, same
  direct-invoke shape as `toggleWantToMake`/`setRating`.
- New env var `BLOB_READ_WRITE_TOKEN`, documented in `.env.example`. **User still needs to**
  create a Blob store in the Vercel dashboard and add the token locally (`.env.local`) to
  actually test the upload path itself; Vercel adds it automatically for the deployed app
  once a store exists.
- Build/typecheck/lint/unit tests (39) all clean. DECISIONS entry written (options
  considered: pasted URLs only, Postgres bytea, Vercel Blob). ARCHITECTURE.md updated,
  client-component count now ten, INTERVIEW.md Q1/Q27 updated to match.
- The DB side (table + relation) is verified as of the closing entry below; the actual
  browser -> Blob -> `/api/upload` round trip is still unexercised, `BLOB_READ_WRITE_TOKEN`
  isn't set locally yet.

## Three pending migrations applied, auth/session flow verified end to end (12/09)

- Ran `npm run db:migrate` (this time the sandbox allowed it): all three queued migrations
  landed on the shared Neon DB (`session`, `recipe.prepTime`/`cookTime`/`ovenTemp`,
  `recipe_image`). This was the actual cause of the query error the user hit
  (`getRecipes`'s `SELECT` names `prep_time`/`cook_time`/`oven_temp`, columns that didn't
  exist yet), not a bug in the query itself.
- Verified the whole auth/session rebuild for real, not just by reading the code: started
  `npm run dev`, then drove it with `curl` through a genuine browser-shaped flow rather than
  guessing at one. First attempt failed (plain `-d "password=..."` POST, wrong `Content-Type`
  and missing the `$ACTION_ID_...` hidden field Next embeds in the form's HTML for its
  no-JS-capable Server Action path); fetched the real `/login` markup, found the actual field
  Next expects, resubmitted as `multipart/form-data` with it included. That worked:
  - Login sets a real `rf_auth` session cookie (not the old static digest).
  - `GET /` with that cookie returns 200 and renders (confirms the `prep_time`/`cook_time`/
    `oven_temp` columns and the join both work now).
  - `GET /recipes/:id` with that cookie returns 200, including the new "Photos" section
    (confirms the `recipe_image` relation resolves, even with zero rows).
  - Logout deletes the session row and immediately re-gates (`GET /` back to a 307).
- Dev server killed afterward, nothing left running.
- **Still unverified at this point:** the photo upload path (`BLOB_READ_WRITE_TOKEN` wasn't
  set locally yet), and the `vercel-build` production-gated migration path (needs an actual
  push).
- DECISIONS.md confidence notes updated for the real-sessions and photo-upload entries to
  match what's now actually been exercised.

## Photo upload path verified; first Blob store had to be recreated as public (12/09)

- User added `BLOB_READ_WRITE_TOKEN` to `.env.local`. First real upload attempt through the
  actual `@vercel/blob/client` `upload()` call failed on two things in turn, both fixed
  without touching app code:
  1. `BlobError: Failed to retrieve the client token`, turned out to be `/api/upload` itself
     redirecting to `/login` (307), the test script wasn't sending a session cookie and
     `proxy.ts` correctly gates that route too. Fixed by logging in via curl first and
     passing the cookie through `upload()`'s `headers` option.
  2. `Cannot use public access on a private store`, the user's first Blob store had been
     created as **private**; this app needs `access: "public"` (photos are plain `<img
     src>`, no per-request auth). Checked Vercel's docs: access mode **can't be changed
     after a store is created**, only chosen at creation. User deleted the private store
     (nothing had ever been written to it, confirmed before deleting) and created a new one
     as public, updated the token.
- With both fixed: ran the real upload end to end (a 1x1 PNG, through `/api/upload`, into
  the new public store), inserted the same DB row `addRecipeImage` would (the action itself
  can't be curl-tested, same Flight-protocol limitation as `toggleWantToMake`), confirmed the
  photo actually renders on the detail page, then deleted both the blob and the row and
  confirmed both gone.
- Scratch test scripts (`.scratch-*.mts`, gitignore-worthy but deleted rather than committed
  either way) removed after; dev server killed.
- DECISIONS.md's photo-upload entry confidence raised to high, with the private-vs-public
  gotcha written up as the one real lesson from this pass.

## Instagram capture removed (15/09)

- `captureFromInstagramUrl` and `isInstagramUrl` deleted from `app/lib/capture.ts`.
  `importFromUrl` always uses `captureFromWebUrl` now, no hostname branch. Form placeholder
  on `/recipes/new` no longer mentions Instagram. `capture.test.ts`'s `isInstagramUrl` tests
  removed (37 passing, down from 39).
- Reasoning: Instagram is a mobile-app product, recipes found there get saved inside
  Instagram's own save feature, not copied out as a URL and pasted into a browser form. The
  oEmbed rung was also expected to fail most of the time anyway (day 7's own note said so),
  so it was real code earning very little. Fallback ladder is now two rungs: JSON-LD, then
  paste it yourself.
- `sourceType` keeps `'instagram'` as a possible value on old rows only, no migration
  needed, it was always a plain `text` column with no CHECK constraint.
- DECISIONS entry: "Cutting Instagram capture" (the original capture entry from day 7 is
  left as-is, historical record of why it was built that way at the time). README,
  ARCHITECTURE updated. INTERVIEW.md Q23's fallback-ladder answer rewritten to match; Q25
  (which asked about the now-removed oEmbed behavior) repurposed into a question about this
  cut instead of left stale.
- Build/typecheck/lint/unit tests all clean.

## Whole-codebase review: five real fixes, one factual correction (16/09)

A full pass over every file, not just the working-tree diff, using `/code-review` at high
effort with independent verification. Eight findings, six addressed:

- **Blob storage leak on recipe delete.** `deleteRecipe` deleted the recipe row (which
  cascade-deletes `recipe_image` rows via the FK) but never told Vercel Blob to delete the
  actual files. Every deleted recipe's photos were leaking forever with no code path left
  that could find them again. Fixed: `deleteRecipe` now looks up the recipe's images and
  calls `del()` on each, best-effort (`Promise.allSettled`, a failed blob delete shouldn't
  block deleting the recipe itself).
- **`deleteRecipeImage`'s delete order was backwards.** It deleted the Blob object first,
  then the DB row. A DB failure in between left a row pointing at a permanently-404 URL,
  a broken image nothing would ever retry. Flipped: DB row (and `revalidatePath`) first,
  Blob delete after, swallowed on failure, since the user-visible part already succeeded
  by then and a leftover orphaned blob is harmless.
- **Search didn't escape SQL LIKE wildcards.** Searching for a title containing a literal
  `%` or `_` (`"50% Whole Wheat Bread"`) let Postgres read it as a wildcard instead of a
  literal character. New `escapeLikePattern()` in `data.ts` escapes `\`, `%`, and `_`
  before building the `ILIKE` pattern.
- **`recipeInstructions` parsing silently dropped real steps for `HowToSection`-grouped
  recipes.** Sites that group steps under headings ("For the crust" / "For the filling")
  use a `HowToSection` object (`{ name, itemListElement: [...] }`), which the old parser
  read as a `HowToStep` and returned just the heading, the actual steps inside
  `itemListElement` were silently lost, capture still reported success. Fixed with a
  recursive `flattenInstructionItem()` in `capture.ts`; new test covers it (38 passing).
- **Login used `!==` on the password**, not constant-time. Added `timingSafeEqual()` to
  `auth.ts` (compares every byte regardless of where the first mismatch is) and switched
  `login` to use it. Rate limiting / lockout on repeated attempts was flagged too and
  deliberately left alone: `APP_PASSWORD` has enough entropy that brute force isn't
  practically feasible regardless, same "single-user, known, would fix before it mattered"
  treatment as the SSRF gap (Q24), not silently missed.
- **`proxy.ts` runs on the Node.js runtime, not Edge.** This was wrong everywhere it was
  stated, `auth.ts`'s top comment, `ARCHITECTURE.md` (three places), and INTERVIEW.md's
  Q21, all of which said Edge. Checked directly against `node_modules/next/dist/docs`:
  Next 16 changed Proxy's default runtime to Node.js, and the `runtime` config option
  isn't even settable in Proxy files anymore. Auth still uses only Web Crypto, but the
  reason is portability, not a runtime constraint, since there was never a real one here.
  `auth.ts` and `ARCHITECTURE.md` corrected; INTERVIEW.md's Q21 rewritten (its whole
  premise was inverted); the day-10 LOG entry above is left as-is, an honest record of
  what was believed at the time, not rewritten to look like it was always known.
- **SSRF in `captureFromWebUrl`** was re-confirmed but not changed, it's already a known,
  documented, deliberately-deferred gap (Q24, DECISIONS, the SPEC's own framing), not a new
  finding.

Build/typecheck/lint/unit tests all clean after every fix. Also a useful reminder of why
the docs need a real review pass now and then, not just updates alongside whatever feature
touched them last: the Edge/Node mistake had been sitting in the codebase since day 10 and
was never once caught, because nobody had checked it against the actual framework docs
until this pass did.
