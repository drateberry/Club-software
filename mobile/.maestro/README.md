# Mobile Maestro flows

Lightweight smoke checks for the Expo app. Maestro is an open-source
mobile UI testing tool that runs against real devices + simulators.

## Local

```bash
brew install maestro             # or follow https://maestro.mobile.dev
pnpm --filter mobile ios         # or android
maestro test mobile/.maestro/auth.yaml
```

## What these cover

- `auth.yaml` — app boots to /login and "Sign in" launches the OAuth
  flow. Maestro hands off to the OS browser; in-browser steps live
  in the web Playwright suite.
- `member-pass.yaml` — Member tab renders the QR pass via
  `/api/pass/{token}`. Verifies the round-trip `/api/v1/me` → pass.
- `member-invoices.yaml` — Member tab shows the invoice list (or the
  empty-state message). Pre-seeded bearer token via launch arguments.
- `staff-checkin.yaml` — Staff tab opens and renders the camera
  scanner panel (camera permission prompt or Start button).

## Seed tokens

Maestro doesn't drive an OAuth flow reliably. The flows accept a
pre-issued bearer token via `launchArguments.seedToken`. Use
`scripts/issue-token.ts` (web) to mint one offline, then export it:

```bash
export SEED_BEARER_TOKEN=$(pnpm --filter app issue-token member@example.com)
maestro test mobile/.maestro/member-invoices.yaml
```

## CI

Maestro Cloud runs the suite against device farms; configure in
`.github/workflows/club-os-ci.yml` with a `MAESTRO_API_KEY` secret
(out of scope for this commit's pure-code work — needs a Maestro
Cloud account).
