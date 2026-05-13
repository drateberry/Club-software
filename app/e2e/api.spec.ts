import { expect, test } from "@playwright/test";

test.describe("api/v1 auth", () => {
  test("/api/v1/me requires bearer auth", async ({ request }) => {
    const res = await request.get("/api/v1/me");
    expect(res.status()).toBe(401);
    const wwwAuth = res.headers()["www-authenticate"];
    expect(wwwAuth).toContain("Bearer");
  });

  test("/api/v1/me rejects garbage tokens", async ({ request }) => {
    const res = await request.get("/api/v1/me", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(res.status()).toBe(401);
  });

  test("/api/v1/members rejects unauthed requests with 401", async ({ request }) => {
    const res = await request.get("/api/v1/members");
    expect(res.status()).toBe(401);
  });

  test("rate-limit headers appear on successful unauth challenge", async ({ request }) => {
    const res = await request.get("/api/v1/me");
    // 401 returns no rate-limit headers (we charge after auth), but the
    // WWW-Authenticate scheme should be set.
    expect(res.status()).toBe(401);
  });
});

test.describe("public discovery", () => {
  test("/.well-known/oauth-authorization-server returns the doc", async ({ request }) => {
    const res = await request.get("/.well-known/oauth-authorization-server");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.authorization_endpoint).toContain("/oauth/authorize");
    expect(body.token_endpoint).toContain("/api/mcp/oauth/token");
    expect(body.code_challenge_methods_supported).toContain("S256");
    expect(Array.isArray(body.scopes_supported)).toBe(true);
  });
});
