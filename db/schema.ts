import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Deliberately flat. `ingredients` and `steps` are freeform text, not their own
// tables — the ingredient graph is project 2's problem. The one modelling concept
// here is the `recipe_tag` many-to-many.

export const recipes = pgTable("recipe", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  sourceType: text("source_type"), // 'instagram' | 'web' | 'manual'
  imageUrl: text("image_url"), // oEmbed thumbnail or og:image
  ingredients: text("ingredients"), // freeform, one per line
  steps: text("steps"), // freeform / markdown
  notes: text("notes"),
  wantToMake: boolean("want_to_make").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    // bumped by Drizzle on every update() call — no DB trigger needed
    .$onUpdate(() => new Date()),
});

export const tags = pgTable("tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
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
export const recipesRelations = relations(recipes, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
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
