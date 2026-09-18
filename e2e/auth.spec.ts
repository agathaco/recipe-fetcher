import { expect, test } from "@playwright/test";

// Real accounts now, not one shared APP_PASSWORD, so a login-flow test needs
// its own account to log into. Sign one up fresh per test run (unique email
// per run, via Date.now()) rather than relying on a fixture user existing in
// whatever database this suite happens to run against.
function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/recipes/new");
  await expect(page).toHaveURL(/\/login\?from=%2Frecipes%2Fnew/);
});

test("sign up, log out, wrong password errors, correct password signs in", async ({
  page,
}) => {
  const email = freshEmail();
  const password = "correct-horse-battery-staple";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();

  // Sign out lives inside the avatar menu now, not a standalone button.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-not-it");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  // The failed attempt redirects to a fresh /login?error=1&email=..., which
  // should come back with the email still filled in, only the password
  // needs retyping.
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
});

test("a second account never sees the first account's recipes", async ({ browser }) => {
  const [ctxA, ctxB] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pageA, pageB] = await Promise.all([ctxA.newPage(), ctxB.newPage()]);

  const title = `e2e-private-recipe-${Date.now()}`;

  // Account A signs up and creates a recipe.
  await pageA.goto("/signup");
  await pageA.getByLabel("Email").fill(freshEmail());
  await pageA.getByLabel("Password").fill("correct-horse-battery-staple");
  await pageA.getByRole("button", { name: "Create account" }).click();
  await expect(pageA).toHaveURL("http://localhost:3000/");

  await pageA.goto("/recipes/new");
  await pageA.getByLabel("Title").fill(title);
  await pageA.getByRole("button", { name: "Save recipe" }).click();
  await expect(pageA.getByRole("heading", { name: title })).toBeVisible();

  // Account B signs up separately and should not see it.
  await pageB.goto("/signup");
  await pageB.getByLabel("Email").fill(freshEmail());
  await pageB.getByLabel("Password").fill("correct-horse-battery-staple");
  await pageB.getByRole("button", { name: "Create account" }).click();
  await expect(pageB).toHaveURL("http://localhost:3000/");
  await expect(pageB.getByText(title)).not.toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
