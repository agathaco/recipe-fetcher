import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// `steps` is still freeform text, no structure attempted there. `ingredients`
// used to be too, until this project grew past its original "capture, store,
// find" scope (see DECISIONS/LOG): `recipe_ingredient` now holds a
// best-effort structured parse alongside the raw line, see its own comment
// below. The other modelling concept here is the `recipe_tag` many-to-many.

// Real per-account credentials. Added when the app grew from single-shared-
// password to real multi-user auth; every recipe and tag now belongs to one
// of these, enforced in the data layer, not just at the login gate.
export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipes = pgTable("recipe", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  sourceType: text("source_type"), // 'web' | 'manual' (was also 'instagram'; existing rows may still have it)
  imageUrl: text("image_url"), // JSON-LD image from capture, or typed/edited by hand
  // Freeform, one per line, still the source of truth for display. Kept even
  // though `recipe_ingredient` now also exists: replacing this outright would
  // mean every recipe needs re-parsing before it displays right again, see
  // that table's own comment.
  ingredients: text("ingredients"),
  steps: text("steps"), // freeform / markdown
  notes: text("notes"),
  // Freeform text, not structured minutes/degrees, same call as ingredients/
  // steps: "20 min" vs "PT20M", "180C fan" vs "356" all need to just work, and
  // parsing/normalising units is the project-2 problem, not this one's.
  prepTime: text("prep_time"),
  cookTime: text("cook_time"),
  ovenTemp: text("oven_temp"),
  wantToMake: boolean("want_to_make").notNull().default(false),
  rating: integer("rating"), // 1-5, or null for unrated
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    // bumped by Drizzle on every update() call, no DB trigger needed
    .$onUpdate(() => new Date()),
});

// Server-side login sessions. `id` is SHA-256(token), never the raw token, so
// the cookie (which holds the raw token) is the only place the live credential
// exists, same reasoning as hashing the password. Replaces a static
// digest-of-the-password cookie that never expired and couldn't be revoked
// per-device (see DECISIONS: "Real sessions, not a static cookie").
export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Tags are per-user, not global: two people can both have a "vegan" tag, and
// neither sees the other's. `unique` is now (ownerId, name), not name alone.
export const tags = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [unique().on(t.ownerId, t.name)],
);

// One row per ingredient line, alongside `recipe.ingredients`'s text blob,
// not replacing it. `rawText` is always the line as typed/imported;
// `quantity`/`unit`/`name` are a best-effort parse of it (see
// app/lib/ingredients.ts), any of which can be null/incomplete if the line
// couldn't be confidently read, "2 eggs" and "thumb of ginger" are both
// valid, differently-parsed rows. `position` replaces "order implied by
// newlines in a text blob", explicit ordering now that this has its own
// table. Written going forward only (new recipes, or an existing one the
// next time it's edited), not backfilled onto old recipes on a schema
// change, see DECISIONS.
export const recipeIngredients = pgTable(
  "recipe_ingredient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    rawText: text("raw_text").notNull(),
    // doublePrecision, not Drizzle's `numeric`: numeric comes back as a
    // string by default (arbitrary-precision decimals don't map cleanly to
    // JS numbers), and a recipe quantity doesn't need that precision, a
    // plain float keeps every consumer working with a real `number`.
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    name: text("name").notNull(),
  },
  (t) => [index("recipe_ingredient_recipe_id_idx").on(t.recipeId)],
);

// A recipe's photo gallery: one-to-many, separate from `recipe.imageUrl`
// (the pasted/captured cover image shown on cards) on purpose. Uploading a
// gallery photo doesn't change the card thumbnail, that stays a deliberate,
// explicit choice via the Image URL field.
export const recipeImages = pgTable("recipe_image", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // Vercel Blob URL
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipeTags = pgTable(
  "recipe_tag",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] })],
);

// Relations let the Drizzle query API walk recipe -> tags without hand-written joins.
export const usersRelations = relations(users, ({ many }) => ({
  recipes: many(recipes),
  tags: many(tags),
  sessions: many(sessions),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(users, { fields: [recipes.ownerId], references: [users.id] }),
  recipeTags: many(recipeTags),
  images: many(recipeImages),
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeImagesRelations = relations(recipeImages, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeImages.recipeId],
    references: [recipes.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  owner: one(users, { fields: [tags.ownerId], references: [users.id] }),
  recipeTags: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));
