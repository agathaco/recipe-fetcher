import { describe, expect, it } from "vitest";

import { parseIngredientLine } from "./ingredients";

describe("parseIngredientLine", () => {
  it.each([
    // No space between quantity and unit (common in real text)
    ["120ml olive oil", { quantity: 120, unit: "ml", name: "olive oil" }],
    ["200g sugar", { quantity: 200, unit: "g", name: "sugar" }],
    // Quantity, space, unit word
    ["1 tsp baking soda", { quantity: 1, unit: "tsp", name: "baking soda" }],
    ["2 tbsp curry powder", { quantity: 2, unit: "tbsp", name: "curry powder" }],
    // Quantity, no unit word: the whole rest is the name
    ["2 eggs", { quantity: 2, unit: null, name: "eggs" }],
    ["3 ripe bananas", { quantity: 3, unit: null, name: "ripe bananas" }],
    ["1 whole chicken", { quantity: 1, unit: null, name: "whole chicken" }],
    // Unit word trails the noun instead of leading it: a known long-tail
    // miss, "cloves" is never reached because "garlic" isn't a unit word.
    ["2 garlic cloves", { quantity: 2, unit: null, name: "garlic cloves" }],
    // A unit word with no leading digit at all, plus an "of" to strip
    ["pinch of salt", { quantity: null, unit: "pinch", name: "salt" }],
    // No digit, no recognised unit word: whole line becomes the name
    ["thumb of ginger", { quantity: null, unit: null, name: "thumb of ginger" }],
    ["salt, pepper", { quantity: null, unit: null, name: "salt, pepper" }],
    // Fractions and mixed numbers
    ["1/2 cup sugar", { quantity: 0.5, unit: "cup", name: "sugar" }],
    ["1 1/2 tsp salt", { quantity: 1.5, unit: "tsp", name: "salt" }],
    ["2 1/2 cups flour", { quantity: 2.5, unit: "cup", name: "flour" }],
    // Decimals
    ["0.5 cup butter", { quantity: 0.5, unit: "cup", name: "butter" }],
    // Informal count words, including packaging words that stay glued to
    // the name once a different unit has already been consumed
    ["1 stick butter", { quantity: 1, unit: "stick", name: "butter" }],
    ["1 can chickpeas", { quantity: 1, unit: "can", name: "chickpeas" }],
    ["400g tin chickpeas", { quantity: 400, unit: "g", name: "tin chickpeas" }],
    // Unit word variants normalise to the same canonical form
    ["2 tablespoons honey", { quantity: 2, unit: "tbsp", name: "honey" }],
    ["500 grams flour", { quantity: 500, unit: "g", name: "flour" }],
    // Case-insensitive unit matching
    ["2 Cups Flour", { quantity: 2, unit: "cup", name: "Flour" }],
  ])("parses %s", (raw, expected) => {
    expect(parseIngredientLine(raw)).toEqual(expected);
  });

  it("trims surrounding whitespace", () => {
    expect(parseIngredientLine("  200g flour  ")).toEqual({
      quantity: 200,
      unit: "g",
      name: "flour",
    });
  });
});
