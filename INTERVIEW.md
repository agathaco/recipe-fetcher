# Interview prep: defending this project

A critical-but-fair hiring manager's questions about recipe-fetcher, framed as
"a free-time exercise to get hands-on with these techs, not to reinvent anything."

The framing is good: it means missing infrastructure isn't held against me. It also
means the interviewer pushes on **whether I actually understand the choices** and
**whether I know what I skipped and why**.

How to use this: for each question, the "Testing" line is what a good answer needs to
show. Fill in "My answer" in my own words. Cross-check against `DECISIONS.md`.

Where I'm most exposed: the shared test database, the SSRF in `captureFromWebUrl`, and
"I opted out of the caching model." Name the first two before they find them; the third
is fine if framed as a deliberate, understood tradeoff.

---

## Scope and framing

### Q1. Walk me through the app in 60 seconds, then tell me the one thing you're most proud of understanding and the one thing you're least sure about.
**Testing:** can you be concise, and are you self-aware.
**My answer:**

### Q2. Why these techs? What were you trying to be able to speak to afterwards?
**Testing:** was there intent, or did you follow a tutorial.
**My answer:**

### Q3. What did you deliberately not build, and how did you decide the line?
**Testing:** scoping judgement.
**My answer:**

---

## The rendering model (the headline goal)

### Q4. Your list page queries Postgres directly in a Server Component. Explain what happens on a cold request, from the browser hitting Vercel to HTML on screen. Where does the query run?
**Testing:** do you actually understand RSC, or just the syntax.
**My answer:**

### Q5. What's in the JavaScript bundle for that page? Why isn't the Drizzle client in it?
**Testing:** the server/client split.
**My answer:**

### Q6. You have `export const dynamic = "force-dynamic"` on basically every route. What is it doing, and what did you give up by using it?
**Testing:** do you know the caching model exists.
**My answer:**

### Q7. (Follow-up) So did you actually learn Next's caching model, or did you opt out of it?
**Testing:** honesty and depth. Good answer: "I chose the safe default because I didn't trust myself to keep `revalidatePath` in sync. Here's what I'd need to understand to change that." (DECISIONS covers this.)
**My answer:**

### Q8. You call `revalidatePath("/")` after a mutation. On a `force-dynamic` page, what does that actually accomplish?
**Testing:** whether you understand the primitive or cargo-culted it.
**My answer:**

---

## Server Actions and mutations

### Q9. Why Server Actions instead of API routes for your mutations? When would you have needed a Route Handler?
**Testing:** DECISIONS covers this.
**My answer:**

### Q10. Your `deleteRecipe` action is reachable by a direct POST, not just your UI. What protects it?
**Testing:** do you know Server Actions do an origin check, and that there's no per-user authz because it's single-user.
**My answer:**

### Q11. The rating and want-to-make toggles call Server Actions directly from `onClick`, no form. How does the optimistic-then-reconcile flow work? What happens if the action throws?
**Testing:** `useOptimistic` + `useTransition`, and error boundary behaviour.
**My answer:**

### Q12. `setRecipeTags` deletes every tag link and reinserts on each save. Talk me through that. What's the cost, when would it bite?
**Testing:** can you reason about a wasteful pattern you chose on purpose.
**My answer:**

---

## Data layer

### Q13. Why Drizzle over Prisma? Where does Drizzle cost you versus Prisma?
**Testing:** DECISIONS covers this well.
**My answer:**

### Q14. Why Postgres over a document store for this data? What in your schema makes it relational?
**Testing:** the `recipe_tag` many-to-many. Be able to draw it.
**My answer:**

### Q15. `getRecipes` does a `LEFT JOIN` then filters by tag in JavaScript, not in the `WHERE` clause. Why? Is that a problem? At what scale?
**Testing:** you documented why (the join fans out and a WHERE would drop a matching recipe's other tags). Know the scale limit.
**My answer:**

### Q16. Your tag find-or-create is a loop: an `INSERT ... ON CONFLICT` plus a `SELECT` per tag. That's N+1. Does it matter? How would you do it in one round trip?
**Testing:** you flagged this in a comment. Can you actually fix it.
**My answer:**

### Q17. There's no pagination on the list. You fetch every recipe on every page load. When does that stop being fine?
**Testing:** awareness of a real limit.
**My answer:**

### Q18. How do database migrations reach production?
**Testing:** you hit this bug. Good story: "Vercel doesn't run `db:migrate`. I learned that when a column was missing. I run it manually against the Neon connection string; a real setup runs it in a deploy step or CI."
**My answer:**

---

## Auth

### Q19. Walk me through your auth. What's in the cookie and why the digest instead of the password?
**Testing:** DECISIONS covers this.
**My answer:**

### Q20. That cookie is a static value with no server-side session. What are the consequences? How would you invalidate a session?
**Testing:** you know the limits of what you built.
**My answer:**

### Q21. `proxy.ts` runs on the Edge runtime. What can't you do there, and how did that constrain your auth code?
**Testing:** why `auth.ts` uses only Web Crypto.
**My answer:**

### Q22. Why is middleware-only auth fine here, and what would you add for a second user?
**Testing:** DECISIONS covers this. Real identity, per-user checks in the data layer, probably Auth.js.
**My answer:**

---

## The capture feature

### Q23. Walk me through the fallback ladder.
**Testing:** DECISIONS covers this. JSON-LD, then oEmbed, then paste it yourself.
**My answer:**

### Q24. Your `captureFromWebUrl` does a server-side `fetch` of any URL the user pastes. What could go wrong?
**Testing:** SSRF. This is a real vulnerability and I want to see if you spot it unprompted. Good answer: "that's server-side request forgery. The server will fetch internal addresses like `169.254.169.254` or a private service. I'd validate the URL is public, block private IP ranges and redirects into them, maybe allowlist. I didn't because it's single-user and local, but I know it's there."
**My answer:**

### Q25. Instagram's oEmbed will mostly fail for you. Did you know that going in, and how did you design around it?
**Testing:** did you research or assume.
**My answer:**

### Q26. What happens if a recipe site takes 30 seconds to respond?
**Testing:** no timeout on the fetch. What would you add.
**My answer:**

---

## Client / server boundary

### Q27. You have five client components. For each, tell me the specific reason it can't be a Server Component.
**Testing:** do you understand the boundary or sprinkle `"use client"`.
**My answer:**

### Q28. Your live search debounces and calls `router.replace`. Why `replace` not `push`? Why keep the query in the URL at all?
**Testing:** DECISIONS covers this.
**My answer:**

---

## Production readiness

### Q29. What would you test first, and with what? (You now have tests, so: why that split, what's still missing?)
**Testing:** Vitest + Playwright, why Playwright isn't optional (async RSC), the missing integration layer.
**My answer:**

### Q30. No error boundaries. What does a user see if Neon is down when they load the list?
**Testing:** you know there's a gap. `error.tsx`, `not-found.tsx`.
**My answer:**

### Q31. Every page view hits the database. What's that costing in latency and Neon usage, and what's the first optimization?
**Testing:** cost awareness, and the caching model again.
**My answer:**

### Q32. What's your rollback story if a deploy is bad?
**Testing:** Vercel instant rollback to a previous deployment; migrations are the hard part (they don't roll back automatically).
**My answer:**

---

## Reflection (always asked)

### Q33. What surprised you?
**My answer:**

### Q34. What would you build differently if you started over tomorrow?
**My answer:**

### Q35. Which of your decisions do you now think was wrong?
**My answer:**

### Q36. If you had two more days, what's the highest-value thing you'd add?
**My answer:**
