import { config } from "dotenv";
import { eq } from "drizzle-orm";

// Load env before importing ./index (which throws if DATABASE_URL is missing).
// Static imports hoist, so ./index and ./schema are pulled in dynamically below.
config({ path: ".env.local" });

const { db } = await import("./index.js");
const { recipes, tags, recipeTags, users } = await import("./schema.js");

// Recipes and tags are per-user now (see DECISIONS: tags becoming per-user),
// so seeding needs a real account to own the rows. Seeds into the first
// account it finds, or the one matching SEED_EMAIL if given; there's no
// account to invent one for, has to exist already via /signup.
const seedEmail = process.env.SEED_EMAIL;
const [owner] = seedEmail
  ? await db.select().from(users).where(eq(users.email, seedEmail))
  : await db.select().from(users).limit(1);
if (!owner) {
  throw new Error(
    seedEmail
      ? `No account found for SEED_EMAIL=${seedEmail}. Sign up at /signup first.`
      : "No accounts exist yet. Sign up at /signup first, then re-run the seed.",
  );
}
console.log(`Seeding recipes for ${owner.email} (${owner.id})`);

console.log("Clearing existing rows...");
// recipe_tag rows cascade off recipe.id (onDelete: "cascade" in schema.ts),
// so deleting this owner's recipes clears their tag links too, no separate
// recipeTags delete needed, and other accounts' rows are never touched.
await db.delete(recipes).where(eq(recipes.ownerId, owner.id));
await db.delete(tags).where(eq(tags.ownerId, owner.id));

console.log("Inserting tags...");
const tagRows = await db
  .insert(tags)
  .values([
    { name: "dessert", ownerId: owner.id },
    { name: "baking", ownerId: owner.id },
    { name: "quick", ownerId: owner.id },
    { name: "vegetarian", ownerId: owner.id },
    { name: "dinner", ownerId: owner.id },
  ])
  .returning();

const tagId = (name: string) => {
  const row = tagRows.find((t) => t.name === name);
  if (!row) throw new Error(`seeded tag not found: ${name}`);
  return row.id;
};

console.log("Inserting recipes...");
const recipeRows = await db
  .insert(recipes)
  .values([
    {
      title: "Olive oil brownies",
      sourceType: "manual",
      ingredients:
        "120ml olive oil\n200g sugar\n2 eggs\n60g cocoa\n80g flour\npinch of salt",
      steps:
        "Whisk oil and sugar. Beat in eggs. Fold in cocoa, flour, salt. Bake 180C for 22 min.",
      notes: "Better the next day.",
      wantToMake: true,
    },
    {
      title: "Weeknight chickpea curry",
      sourceType: "web",
      sourceUrl: "https://example.com/chickpea-curry",
      ingredients:
        "1 onion\n2 garlic cloves\nthumb of ginger\n2 tbsp curry powder\n400g tin chickpeas\n400g tin tomatoes\n200ml coconut milk",
      steps:
        "Fry onion, garlic, ginger. Add spices. Add chickpeas, tomatoes, coconut milk. Simmer 15 min.",
      wantToMake: false,
    },
    {
      title: "No-knead focaccia",
      sourceType: "instagram",
      sourceUrl: "https://www.instagram.com/p/example",
      imageUrl: "https://picsum.photos/seed/focaccia/800/600",
      ingredients:
        "500g strong flour\n400ml water\n7g instant yeast\n10g salt\nolive oil\nflaky salt, rosemary",
      steps:
        "Mix, rest overnight in fridge. Fold, prove in oiled tin 2h. Dimple, top, bake 220C for 20 min.",
      notes: "Caption said 24h cold prove is worth it.",
      wantToMake: true,
    },
    {
      title: "Lemon roast chicken",
      sourceType: "manual",
      ingredients:
        "1 whole chicken\n1 lemon\n4 garlic cloves\nthyme\nolive oil\nsalt, pepper",
      steps:
        "Rub chicken with oil, salt, pepper. Stuff with halved lemon, garlic, thyme. Roast 200C for 75 min.",
      wantToMake: false,
    },
    {
      title: "Miso caramel banana bread",
      sourceType: "web",
      sourceUrl: "https://example.com/miso-banana-bread",
      ingredients:
        "3 ripe bananas\n100g butter\n150g sugar\n1 egg\n200g flour\n1 tsp baking soda\n1 tbsp white miso",
      steps:
        "Mash bananas. Cream butter, sugar, miso. Add egg, bananas. Fold in dry. Bake 170C for 55 min.",
      notes: "The miso makes it. Do not skip.",
      wantToMake: true,
    },
    // ownerId is the same for every row, added via .map() below rather than
    // repeated 5 times inline.
  ].map((r) => ({ ...r, ownerId: owner.id })))
  .returning();

console.log("Linking recipes to tags...");
const byTitle = (title: string) => {
  const row = recipeRows.find((r) => r.title === title);
  if (!row) throw new Error(`seeded recipe not found: ${title}`);
  return row.id;
};

await db.insert(recipeTags).values([
  { recipeId: byTitle("Olive oil brownies"), tagId: tagId("dessert") },
  { recipeId: byTitle("Olive oil brownies"), tagId: tagId("baking") },
  { recipeId: byTitle("Weeknight chickpea curry"), tagId: tagId("dinner") },
  { recipeId: byTitle("Weeknight chickpea curry"), tagId: tagId("quick") },
  { recipeId: byTitle("Weeknight chickpea curry"), tagId: tagId("vegetarian") },
  { recipeId: byTitle("No-knead focaccia"), tagId: tagId("baking") },
  { recipeId: byTitle("No-knead focaccia"), tagId: tagId("vegetarian") },
  { recipeId: byTitle("Lemon roast chicken"), tagId: tagId("dinner") },
  { recipeId: byTitle("Miso caramel banana bread"), tagId: tagId("dessert") },
  { recipeId: byTitle("Miso caramel banana bread"), tagId: tagId("baking") },
]);

console.log(`Seeded ${recipeRows.length} recipes and ${tagRows.length} tags.`);
process.exit(0);
