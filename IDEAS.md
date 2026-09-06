# Ideas / backlog

Things worth doing later, not committed to. Notes on which ones cross into a later project's
scope (see SPEC.md: project 2 is the recipe pipeline, project 3 is real-time / reminders).

## AI features

Small, one-LLM-call, fits this project's "call an LLM from Next.js" scope:

- **Auto-tag on save.** One call suggests tags from the title and ingredients; user reviews
  before they stick. Removes the tedious part of tagging.
- **Clean up an imported title.** Recipe sites use SEO titles ("The BEST Ever Ultra Fudgy
  Brownies!!"); one call rewrites to "Fudgy brownies" during URL import.
- **Tidy pasted ingredient text** into a clean one-per-line list. Formatting only, not unit
  parsing (that's project 2).
- **Caption blob to fields** (the SPEC's stretch feature): paste a whole Instagram caption,
  one call returns structured title/ingredients/steps to pre-fill the form.

Bigger, most useful, a natural "project 1.5":

- **Semantic search.** Embeddings + `pgvector` (Neon supports it) so "something warm and
  comforting" or "uses up leftover cream" works, not just exact title match. Teaches
  embeddings and a Postgres extension.
- **Duplicate detection.** "You already saved a similar hummus recipe", using the same
  embeddings.

Out of scope per SPEC: OCR / reading text off a recipe image, reel transcription.

## UI / UX

- Adopt a component library (deciding: shadcn/ui) and redo the forms and list with it.
- Fix the page-width shift between filters (scrollbar gutter).
- Show the recipe image on the detail page (and maybe list); `imageUrl` is stored but never
  rendered.
- Wider, friendlier add/edit forms.
- Render `steps` as markdown / numbered list instead of a text blob.
- Dark mode.
- Mobile pass.
- Better empty states.

## Features

- **Search debounce / live search.** Would mean the search input becomes a client component
  that updates the URL on a debounced keystroke (`router.replace`), instead of the current
  plain GET form. Keeps the URL as state, adds a small client boundary.
- **Servings scaling** (x0.5, x2). Note: the SPEC lists "scaling maths" as project 2. A
  naive "multiply the numbers in the text" version is fine; anything that needs to parse
  quantities is project 2.
- **Measurement converter** (metric / imperial). This *is* "unit conversion", which the SPEC
  explicitly defers to project 2. Revisit there, or do a deliberately dumb version.
- Print / cook view (big text, no chrome).
- "Cooked it" log with a date, so "want to make" has a counterpart.
- Sort options on the list (title, recently added, recently updated).
- Keyboard shortcuts (new recipe, focus search).
