# Playwright e2e tests

Golden-path checks against the running Next.js app. Tests run against
a real Postgres (no mocks), use the seeded admin credentials
(`admin@club.local` / `admin1234`), and depend on the dev server.

## Local

```bash
# Boot Postgres + Mailpit
docker compose up -d
pnpm db:migrate
pnpm db:seed

# In another terminal, run the dev server
pnpm dev

# Run tests
pnpm e2e            # headless
pnpm e2e:headed     # with a browser window
```

## CI

`.github/workflows/club-os-ci.yml` runs the suite on every PR that
touches `app/`. The job spins up a Postgres service, runs migrations
+ seed, builds the app, starts it on port 3000, and runs `pnpm e2e`
against it. Stripe and Twilio test keys live in repo secrets;
webhooks are simulated by direct POSTs from the suite.

## What's covered

- **smoke**: unauth redirect, login page renders, OpenAPI spec served
- **api**: bearer auth challenges on `/api/v1/*`, OAuth discovery doc
- **admin-login**: admin password sign-in lands on /dashboard, members
  list reachable

## What's not covered yet

- Stripe Checkout (needs Stripe test mode + webhook simulation)
- Twilio SMS (needs Twilio test creds or mocking)
- Mobile flows (see `mobile/.maestro/` for Maestro coverage)
- Multi-tenant scoping (lands after Phase 15 auto-scoping wires up)
- Full installment + refund cycle (needs a long-running interactive
  scenario; tag for a follow-up suite)
