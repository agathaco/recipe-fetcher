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
- Next: edit and delete, then the caching model in depth.
