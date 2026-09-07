import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/recipes/new");
  await expect(page).toHaveURL(/\/login\?from=%2Frecipes%2Fnew/);
});

test("wrong password errors, correct password signs in", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Password").fill("definitely-not-it");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong password")).toBeVisible();

  await page.getByLabel("Password").fill(process.env.APP_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
});
