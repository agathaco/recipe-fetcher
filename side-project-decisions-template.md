# DECISIONS.md template

Copy the block below into the root of your project repo as `DECISIONS.md`. Add one entry
every time you make a choice that wasn't forced (a library, a pattern, a data-model shape, a
tradeoff you noticed). Write each entry yourself, in your own words, before you move on.

This file is the point of the project as much as the code is. It's what proves you
understood the build instead of letting a tool make the calls. Link to it from your README.

---

```markdown
# Decisions

A log of the choices made in this project and why. Newest at the top.

Rule I'm holding myself to: I don't merge code I can't explain line by line, and every entry
below is something I could defend in an interview. If I can't write the entry, I don't
understand the choice yet.

---

## <short title of the decision>

**Date:** YYYY-MM-DD

**Context:** what was I trying to do, what constraint made this a real choice.

**Options I considered:**
- Option A - one line on what it is
- Option B - one line
- Option C - one line

**Chose:** Option B.

**Why:** the actual reasoning. Not "it's the standard", say what it buys me here and what it
costs. If I'm copying a choice from a tutorial without understanding it, that goes here
honestly and becomes a thing to go back and learn.

**What I'd revisit this under:** the condition that would make me change my mind later
(scale, a second user, a mobile client, a cron job needing the same code, etc.).

**Confidence:** high / medium / still fuzzy on this.
```

---

## Worked example

```markdown
## Queried the database directly in a Server Component instead of building an API route

**Date:** 2026-09-10

**Context:** the recipe list page needs to read all recipes from Postgres and render them.
In the React apps I've worked on, that meant a client component calling a `/api/recipes`
endpoint with a loading state.

**Options I considered:**
- Client component + `/api/recipes` route + fetch + loading spinner - the pattern I know
- Server Component that imports the Drizzle client and queries the DB directly - no endpoint,
  no client fetch, no spinner
- Route Handler that the Server Component calls over HTTP - an endpoint, but still
  server-to-server

**Chose:** Server Component querying the DB directly.

**Why:** the list page is read-only and rendered on the server, so there's no reason to
round-trip through HTTP to my own machine. The query runs during render, the HTML arrives
with the data already in it, and there's no loading state to design because the user never
sees an empty page. An API route would only earn its keep if something outside this app
needed the same data (a mobile client, a webhook, another service). Nothing does yet.

**What I'd revisit this under:** if I add a mobile app, or if the query gets slow enough
that I want to stream the page and load the list in a Suspense boundary, or if I need the
recipe list callable from a background job.

**Confidence:** high on the "why", still medium on exactly how Next.js caches the result of
that query and when it re-runs - separate entry once I've read the caching docs properly.
```

---

## Which choices are worth an entry

Write one for:
- Every library you add (ORM, auth, styling, anything with an alternative)
- Every "should this be a Server Component or a Client Component" that you actually thought about
- Server Action vs Route Handler for a given mutation
- The data-model shape (why `ingredients` is text and not its own table, why the many-to-many)
- Any caching / revalidation behaviour you had to reason about
- Anything you did because a tutorial said so and don't fully get yet (flag it, come back)

Don't write one for: things with no real alternative, or formatting/naming.

## Cadence

Write the entry the same day you make the choice, while the reasoning is fresh. A batch of
entries written at the end from memory is worth much less, and it shows.
