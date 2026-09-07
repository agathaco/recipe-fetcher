import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("add, view, edit and delete a recipe", async ({ page }) => {
  const title = `e2e-brownies-${Date.now()}`;

  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill(title);
  await page.getByPlaceholder("e.g. 200g plain flour").fill("200g flour");
  await page.getByPlaceholder("e.g. Preheat the oven to 180C fan").fill("Mix and bake");
  await page.getByLabel("Add tags").fill("e2e-tag");
  await page.getByRole("button", { name: /^Create/ }).click();
  await page.getByRole("button", { name: "Save recipe" }).click();

  // Redirected to the detail page.
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("200g flour")).toBeVisible();
  await expect(page.getByRole("link", { name: "e2e-tag" })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Title").fill(`${title}-v2`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: `${title}-v2` })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: `${title}-v2` })).toHaveCount(0);
});

test("live search filters the recipe grid", async ({ page }) => {
  const title = `e2e-searchable-${Date.now()}`;

  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("searchbox").fill("e2e-searchable");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("searchbox").fill("zzz-nothing-matches-this");
  await expect(page.getByText("No recipes match that filter.")).toBeVisible();
});
