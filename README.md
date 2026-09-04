# recipe-fetcher

Capture, store, and find recipes so "I feel like baking" starts with a list instead of
scrolling Instagram saves. Side project 1 of the full-stack track.

## Docs

- [SPEC.md](./SPEC.md): scope and the day-by-day plan
- [DECISIONS.md](./DECISIONS.md): choices made in this project and why
- [ARCHITECTURE.md](./ARCHITECTURE.md): how it fits together, what Next.js is doing
- [LOG.md](./LOG.md): thin per-day record of what was built
- [WALKTHROUGH.md](./WALKTHROUGH.md): plain-English log of every setup step and tool

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
db/schema.ts    Drizzle schema: recipe, tag, recipe_tag
db/index.ts     Drizzle client (Neon HTTP driver)
db/migrations/  generated SQL migrations
```
