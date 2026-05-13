# @club-os/sdk

TypeScript SDK for the Club OS REST API. Bearer auth via the MCP
OAuth 2.1 + PKCE flow at `/.well-known/oauth-authorization-server`.

## Usage

```ts
import { ClubOSClient } from "@club-os/sdk";

const client = new ClubOSClient({
  baseUrl: "https://pinehurst.club-os.app",
  getToken: async () => getStoredToken(),
  onUnauthorized: () => clearStoredToken(),
});

const me = await client.me();
const events = await client.listEvents();
const result = await client.logCheckin({ passToken });
```

## Types

All types mirror the server's OpenAPI spec at `/api/v1/openapi.json`.
Keep this package in sync when the server adds endpoints — generated-
style types live in `src/types.ts` and client methods in `src/client.ts`.

## Consumers

- `mobile/` — React Native app, imports via `file:../packages/club-os-sdk`
- External integrators — can vendor the package or import its types
