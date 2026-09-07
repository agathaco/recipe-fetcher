import { describe, expect, it } from "vitest";

import { tagColorClasses } from "./tag-pill";

describe("tagColorClasses", () => {
  it("is deterministic for a given tag", () => {
    expect(tagColorClasses("dessert")).toBe(tagColorClasses("dessert"));
  });

  it("returns a non-empty class string", () => {
    expect(tagColorClasses("baking")).toMatch(/bg-\w+-\d+/);
  });

  it("spreads different tags across more than one colour", () => {
    const names = ["dessert", "baking", "quick", "vegetarian", "dinner", "soup", "cake", "snack"];
    const distinct = new Set(names.map(tagColorClasses));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
