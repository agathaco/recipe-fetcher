# Decisions

A log of the choices made in this project and why. Newest at the top.

Rule I'm holding myself to: I don't merge code I can't explain line by line, and every entry
below is something I could defend in an interview. If I can't write the entry, I don't
understand the choice yet.

---

<!--
Entries still owed (from the tech-choices table in SPEC.md). Write each one yourself:
- Database host: Postgres on Neon
- ORM: Drizzle (vs Prisma, note the "magic vs explicit" tradeoff)
- Auth: password gate in middleware
- Styling: Tailwind
- URL parsing: native fetch + JSON-LD
- Instagram: oEmbed
- Server Component querying the DB directly vs an API route (day 3-4)
- revalidatePath / caching model (day 5-6)
- URL as state for filters (day 8)
- "want to make" as the one client component (day 9)
-->

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
