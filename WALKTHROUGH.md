# Walkthrough — how this project was set up (ELI5)

A plain-English log of every step and every tool, so you can explain the whole thing later.
Companion to [SPEC.md](./SPEC.md) (the plan) and [DECISIONS.md](./DECISIONS.md) (the choices).

---

## 1. The big picture

You're building a website where you save recipes and search them. A website like this has
three moving parts:

1. **The app** — the code that decides what HTML to show. Runs on a server *and* in your
   browser. → **Next.js**
2. **The database** — where the recipes are actually stored, permanently. → **Postgres, hosted on Neon**
3. **The hosting** — a computer on the internet that runs the app 24/7. → **Vercel**

Everything below is just wiring those three together.

```
    your browser
         │  asks for a page
         ▼
   ┌───────────┐   runs your code, queries the DB   ┌──────────────┐
   │  Vercel   │ ─────────────────────────────────▶ │ Neon Postgres │
   │ (Next.js) │ ◀───────────────────────────────── │  (recipes)    │
   └───────────┘        sends back HTML              └──────────────┘
```

---

## 2. The tools, explained simply

| Tool | What it is | Why we use it here |
|---|---|---|
| **Node.js** | A program that runs JavaScript outside a browser. Everything below is a Node program. | It's the engine the whole toolchain runs on. |
| **npm** | Node's "app store" + installer. `npm install X` downloads library X into `node_modules/`. | How we get Next.js, Drizzle, etc. |
| **Next.js** | A framework for building websites in React. Gives you routing, server rendering, and a build system for free. | It's the thing the SPEC exists to teach. |
| **React** | The library for describing UI as components (reusable chunks of HTML+logic). | Next.js is built on it. |
| **TypeScript** | JavaScript with type labels (`title: string`). Catches typos and wrong-shape data before you run. | Fewer dumb bugs; better autocomplete. |
| **Tailwind CSS** | Styling by putting utility classes in your HTML (`class="flex gap-4"`) instead of writing separate CSS files. | Boring and fast; SPEC says don't think about styling. |
| **ESLint** | A nitpicker that flags sketchy code patterns. | Keeps the code tidy. |
| **Postgres** | A relational database — data lives in tables with columns and rows, like linked spreadsheets. | The standard choice; pairs well with Vercel. |
| **Neon** | A company that runs Postgres for you in the cloud so you don't install anything. "Serverless" = it can sleep when unused and wake on demand. | Free, no setup, close to Vercel. |
| **Drizzle ORM** | A translator between your TypeScript code and SQL. You write `db.select().from(recipes)`, it writes `SELECT * FROM recipe`. | You still see real SQL, so you learn what's happening (vs Prisma, which hides more). |
| **drizzle-kit** | Drizzle's command-line helper. Turns your table definitions into `.sql` files ("migrations") and runs them against the database. | How the tables get created. |
| **@neondatabase/serverless** | The specific "driver" (phone line) Drizzle uses to talk to Neon over the internet. | Neon needs its own driver, not the normal Postgres one. |
| **dotenv** | Loads secrets from a `.env.local` file into the program. | Keeps your database password out of the code. |
| **Vercel** | Hosting built by the same people as Next.js. Connects to your GitHub repo and redeploys on every push. | One-click deploy; free tier. |
| **Git** | Tracks every change to your files, lets you undo and see history. | Standard; Vercel deploys *from* git. |
| **GitHub** | A website that stores your git repository online. | Where Vercel reads your code from. |

---

## 3. What's been done so far

### Step A — Created the Next.js app
**Command:** `npx create-next-app@latest .`

`npx` = "download and run this tool once." `create-next-app` is an official generator. It
asked no questions (we passed all the answers as flags: TypeScript yes, Tailwind yes, App
Router yes) and produced:

- `app/` — your pages live here. `app/page.tsx` is the homepage, `app/layout.tsx` wraps
  every page (the `<html>` and `<body>` tags).
- `package.json` — the list of libraries the project uses + shortcut commands.
- config files (`next.config.ts`, `tsconfig.json`, etc.) — leave them alone for now.
- `CLAUDE.md` / `AGENTS.md` — auto-generated notes for AI tools warning that Next.js 16
  changed things vs older tutorials.

**Result:** running `npm run dev` shows a default starter page.

### Step B — Started version control
**Command:** `git init`

Made this folder a git repository. Nothing committed yet — that's step F.

### Step C — Installed Drizzle
**Commands:**
`npm install drizzle-orm @neondatabase/serverless`
`npm install -D drizzle-kit dotenv`

(`-D` = "development only" — tools you need while building but not when the site is live.)

### Step D — Defined the database tables in code
**File:** `db/schema.ts`

This describes three tables in TypeScript:

- **`recipe`** — one row per recipe. Columns: `title`, `sourceUrl`, `sourceType`
  (`'web'`/`'instagram'`/`'manual'`), `imageUrl`, `ingredients` (one big blob of text),
  `steps`, `notes`, `wantToMake` (true/false), plus `createdAt` / `updatedAt` timestamps.
- **`tag`** — one row per tag name (e.g. "dessert"), names must be unique.
- **`recipe_tag`** — the link table. A recipe can have many tags; a tag applies to many
  recipes. This "many-to-many" needs its own table where each row is one pairing
  (recipe #5 ↔ tag "dessert"). This is the one data-model idea the SPEC wants you to learn.

`ingredients` and `steps` are just text on purpose — no fancy structure. That's a
deliberate v1 limit.

**Files:** `db/index.ts` — creates the `db` object your pages will import to run queries.
`drizzle.config.ts` — tells `drizzle-kit` where the schema is and where to find the
database password.

### Step E — Created and applied the first migration
**Commands:**
`npm run db:generate` → wrote `db/migrations/0000_harsh_lila_cheney.sql` (the actual
`CREATE TABLE` SQL, generated from `schema.ts`).
`npm run db:migrate` → connected to Neon and ran that SQL.

**Migration** = a versioned change to the database structure. Each one is a file. Running
them in order takes any database from empty to current. The files are committed to git so
the same steps run on every environment.

**Verified:** queried Neon directly — `recipe`, `tag`, `recipe_tag` all exist. Empty, but
there.

Before this: you created the Neon project (region: **eu-central-1 / Frankfurt**), copied
the **pooled** connection string, and pasted it into `.env.local` as `DATABASE_URL`.
`.env.local` is gitignored so the password never leaves your machine.

### Step F — Fixed a hydration warning
The browser console showed a "hydration mismatch" on `<body>`. Cause: a browser extension
(ColorZilla) adds an attribute to the page before React loads, so React's server HTML and
the browser's HTML didn't match.

**Hydration** = React re-checking, in the browser, the HTML the server already sent, and
attaching event handlers to it. If they don't match, it complains.

**Fix:** added `suppressHydrationWarning` to `<body>` in `app/layout.tsx`. This silences
the warning for that one tag only (not its contents), which is the standard fix because
extensions always mess with `<html>`/`<body>`.

---

## 4. What's left to finish days 1–2

Goal: **empty app, live on the internet, talking to the database.**

### Step G — First commit
```bash
git add -A
git status          # check: .env.local must NOT appear in the list
git commit -m "Scaffold: Next.js app, Drizzle schema, first migration"
```
If `.env.local` shows up, stop — the `.gitignore` should hide it.

### Step H — Put the code on GitHub
Create a **private** repo called `recipe-fetcher`, then:
```bash
git remote add origin https://github.com/<you>/recipe-fetcher.git
git branch -M main
git push -u origin main
```
(Or, with the GitHub CLI: `gh repo create recipe-fetcher --private --source=. --push`.)

### Step I — Deploy to Vercel
1. vercel.com → sign in with GitHub → **Add New → Project** → import `recipe-fetcher`.
2. Expand **Environment Variables**. Add one:
   - Key: `DATABASE_URL`
   - Value: your Neon pooled connection string (the same one in `.env.local`)
3. Click **Deploy**. Wait ~1 minute. Open the URL — the starter page, now public.
4. Project **Settings → Functions** → set region to **Frankfurt (fra1)** so the app and the
   database are on the same continent → redeploy.

From now on, every `git push` to `main` auto-deploys. Every pull request gets its own
temporary "preview" URL.

### Step J — Write the DECISIONS.md entries you owe
In your own words, using the template already in the file:
- **Postgres on Neon** — why hosted serverless Postgres over Supabase / Railway / local Docker.
- **Drizzle over Prisma** — what "Prisma is more magic" actually costs you; when you'd still pick Prisma.

Rule from the SPEC: if you can't write the entry confidently, you don't understand the
choice yet — go read, then write it. Ask for an explanation, not for the text.

---

## 5. What comes after (the rest of the SPEC)

| Days | Focus | Key idea you're learning |
|---|---|---|
| 3–4 | List page + detail page | **Server Components** — the page queries the database directly on the server; the HTML arrives already full of data, no loading spinner. |
| 5–6 | Add / edit / delete | **Server Actions** — form submissions that run a function on the server. Plus caching: when does Next.js reuse an old page, and what forces a refresh. |
| 7 | Paste a URL to import | Server fetches the recipe page, reads its hidden `JSON-LD` recipe data; Instagram via `oEmbed`. Each has a "if it fails, paste it yourself" fallback. |
| 8 | Tags, filter, search | The filter state lives **in the URL** (`?tag=dessert`), not in React memory. |
| 9 | "Want to make" toggle | The **one** interactive-in-the-browser component. Uses optimistic UI (flips instantly, syncs after). |
| 10 | Auth + polish | A password check in `middleware.ts` — code that runs before every page. One user, so one shared password is enough. |
| 11–12 | Import real recipes, write the README | Actually use the thing. |

---

## 6. Quick command reference

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally at localhost:3000 (auto-reloads on save). |
| `npm run build` | Do a production build — catches type errors. |
| `npm run lint` | Run the code nitpicker. |
| `npm run db:generate` | After editing `db/schema.ts`, create a new migration `.sql` file. |
| `npm run db:migrate` | Apply pending migrations to the database in `.env.local`. |
| `npm run db:push` | Sync schema straight to the DB without a migration file (quick dev hack only). |
| `npm run db:studio` | Open a browser GUI to view/edit the data. |
