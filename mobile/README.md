# Club OS Mobile

React Native / Expo app for **Club OS** members and staff. Talks to the
`/api/v1/*` REST shim (which wraps the same handlers as the web app's
Server Actions). OAuth 2.1 + PKCE for sign-in, identical to how Claude
Desktop / Cursor connect to the MCP server.

## Stack

- Expo SDK 52 + Expo Router (typed routes)
- TanStack Query for data fetching + cache
- NativeWind for Tailwind-like styling
- `expo-auth-session` for OAuth 2.1 + PKCE
- `expo-secure-store` for the bearer token
- `expo-camera` for QR pass scanning
- EAS Build for store delivery

## Quick start

```bash
cd mobile
pnpm install
cp .env.example .env.local

# Tip: set EXPO_PUBLIC_CLUB_OS_API_BASE to a URL your simulator/device can
# reach. localhost from a physical iPhone needs your dev machine's LAN IP
# (e.g. http://192.168.1.20:3000) or a tunnel.

pnpm start
# Press i for iOS sim, a for Android, w for web
```

On first launch the app uses MCP Dynamic Client Registration to claim its
own `client_id` from `/api/mcp/oauth/register`, then runs the standard
authorization-code + PKCE flow. The user signs in to the web app in an
in-app browser, approves scopes on the `/oauth/authorize` consent screen,
and is redirected back to `clubos://oauth/callback` with a code. The app
exchanges that code at `/api/mcp/oauth/token` and stores the bearer
token in OS-secure storage.

## Role-aware routing

`app/index.tsx` checks the session token, calls `/api/v1/me`, and routes
by role:

- `MEMBER` → `(member)` tab group: Profile, Invoices, Events, Pass
- `STAFF` / `ADMIN` → `(staff)` tab group: Members, Messages, Check-in, Me

Each tab calls into the v1 REST endpoints. Capabilities and member-scoped
filtering are enforced server-side, so the native client trusts what the
API returns — it doesn't reimplement scope logic locally.

## Project layout

```
mobile/
  app/
    _layout.tsx           Root provider (QueryClientProvider, status bar)
    index.tsx             Auth-aware redirector
    login.tsx             OAuth sign-in trigger
    (member)/             Member tab group
    (staff)/              Staff + admin tab group
  components/             Card, Button (NativeWind-styled primitives)
  lib/
    api.ts                fetch wrapper with bearer auth
    auth.ts               OAuth 2.1 + PKCE + DCR
    config.ts             API base + scheme + redirect URI
    hooks.ts              TanStack Query hooks per endpoint
    format.ts             Locale-aware money/date formatters
    queryClient.ts
  global.css              Tailwind directives
  tailwind.config.js
  babel.config.js
  metro.config.js
  app.json                Expo config (bundle id, scheme, plugins)
  eas.json                EAS build profiles
```

## Configuring against a deployed Club OS

Set `EXPO_PUBLIC_CLUB_OS_API_BASE` in `.env.local` to the club's
deployed origin (e.g. `https://pinehurst.club-os.app`). DCR works against
any club deployment that exposes `/.well-known/oauth-authorization-server`.

To pre-register a stable client_id in production (e.g. for App
Store builds where DCR-on-first-launch is undesirable), POST to the
registration endpoint once and set `EXPO_PUBLIC_MCP_CLIENT_ID` in your
EAS build profile.

## Native build (EAS)

```bash
pnpm exec eas login
pnpm exec eas init             # only once, creates an EAS project
pnpm exec eas build --profile preview --platform ios
pnpm exec eas build --profile preview --platform android
```

## Limits

- Stripe card-on-file additions are deferred to the Customer Portal flow
  (in-app browser); a native Stripe Elements binding is not yet wired.
- Push notifications are not configured yet.
- iOS Wallet / Google Wallet passes for the QR pass are not implemented;
  the in-app `Pass` tab works with the existing `/api/pass/[token]` PNG.
