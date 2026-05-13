import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("root redirects unauthenticated users to /login", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).toBeTruthy();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("/login renders the magic-link + password forms", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /email me a sign-in link/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("OpenAPI spec is served and well-formed", async ({ request }) => {
    const res = await request.get("/api/v1/openapi.json");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.openapi).toMatch(/^3\.1/);
    expect(body.info.title).toBe("Club OS API");
    expect(typeof body.paths).toBe("object");
    expect(body.paths["/api/v1/me"]).toBeTruthy();
  });
});
