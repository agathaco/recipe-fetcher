# recipe-fetcher

Capture, store, and find recipes so "I feel like baking" starts with a list instead of
scrolling Instagram saves. Side project 1 of the full-stack track — see [SPEC.md](./SPEC.md)
for scope and [DECISIONS.md](./DECISIONS.md) for the choices log.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Postgres on Neon, Drizzle ORM
- Deployed on Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL from Neon
npm run db:migrate           # apply migrations to your Neon branch
npm run dev
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run db:generate` | generate a new SQL migration from `db/schema.ts` |
| `npm run db:migrate` | apply pending migrations |
| `npm run db:push` | push schema straight to the DB (dev only, skips migration files) |
| `npm run db:studio` | Drizzle Studio |

## Layout

```
app/            routes (App Router)
db/schema.ts    Drizzle schema — recipe, tag, recipe_tag
db/index.ts     Drizzle client (Neon HTTP driver)
db/migrations/  generated SQL migrations
```
