import { expect, type Page } from "@playwright/test";

// Real accounts, not one shared APP_PASSWORD: any test that needs to be
// signed in signs its own fresh account up first, named with the "e2e-"
// prefix global-teardown cleans up. Each call makes a brand new account, so
// tests never see another test's data by accident, that isolation now comes
// free from the ownerId scoping instead of needing to be arranged by hand.
export async function signIn(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}
