import { expect, test } from "@playwright/test";

/**
 * Requires the dev seed to have run, providing the admin@club.local /
 * admin1234 credentials. CI runs `pnpm db:seed` before these tests.
 */
test.describe("admin login + dashboard", () => {
  test("password sign-in lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    const passwordForms = page.locator("form").filter({ hasText: /^Sign in$/ });
    await passwordForms.first().locator('input[name="email"]').fill("admin@club.local");
    await passwordForms.first().locator('input[name="password"]').fill("admin1234");
    await passwordForms.first().getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("members list is reachable after login", async ({ page }) => {
    await page.goto("/login");
    const passwordForms = page.locator("form").filter({ hasText: /^Sign in$/ });
    await passwordForms.first().locator('input[name="email"]').fill("admin@club.local");
    await passwordForms.first().locator('input[name="password"]').fill("admin1234");
    await passwordForms.first().getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);

    await page.getByRole("link", { name: /members/i }).first().click();
    await expect(page).toHaveURL(/\/members/);
    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
  });
});
