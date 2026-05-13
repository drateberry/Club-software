# Multi-tenant architecture

Club OS supports multiple clubs in a single Postgres deployment via a
three-layer defense:

1. **App-layer tenant context** — every Server Action / API request /
   MCP call enters an `AsyncLocalStorage` scope on auth, carrying the
   user's `clubId`. The Prisma client extension auto-injects
   `where: { clubId }` on reads and `data: { clubId }` on writes for
   the 21 tenant-scoped models.
2. **Postgres Row-Level Security** — when enabled, the database
   enforces tenant isolation independently of the application. A bug
   in the app layer can't leak cross-tenant rows.
3. **Per-request connection settings** — the app sets `app.club_id`
   as a Postgres session GUC before each query when RLS is enabled.

## Layer 1: auto-scoping (always on)

Implemented in `src/lib/db.ts` + `src/lib/tenantContext.ts`. Entry
points that pin tenant context:

| Entry point | How |
|---|---|
| Server Actions | `requireSession()` in `src/lib/guards.ts` calls `enterTenantContext(user.clubId)` |
| `/api/v1/*` REST | `authenticateBearer()` in `src/lib/mcp/auth.ts` |
| `/api/mcp` JSON-RPC | Same `authenticateBearer()` |
| `/api/search` | Explicit `enterTenantContext` |
| `/oauth/authorize` | Inherits via `requireSession()` |
| Webhooks (Stripe, Twilio) | Pass-through (no auto-scoping; entities looked up by globally unique provider IDs) |
| pg-boss jobs | Pass-through (job data carries tenant if needed) |

The OPERATOR role enters `asOperator: true` — the extension becomes a
no-op so cross-club queries return everything. Used by `/operator/*`
pages.

## Layer 2: enabling RLS

Optional but recommended for shared-Postgres deployments. To enable:

```bash
# 1. Apply the policy SQL (run as Postgres superuser)
psql "$DATABASE_URL" -f prisma/sql/enable-rls.sql

# 2. Flip the runtime flag so the app sends SET app.club_id
export CLUBOS_RLS_ENABLED=1
```

The app sends `set_config('app.club_id', '<club-id>', true)` before
each query when the flag is on. Policies in `enable-rls.sql` permit
the row only when `clubId = app.club_id`, or when the special operator
sentinel `*` is set.

### Recommended deployment role separation

```sql
-- Superuser does migrations + RLS setup
CREATE ROLE clubos_admin WITH LOGIN SUPERUSER PASSWORD '...';

-- Application connects with a non-superuser; cannot BYPASSRLS
CREATE ROLE clubos_app WITH LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE clubos TO clubos_app;
GRANT USAGE ON SCHEMA public TO clubos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clubos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clubos_app;
```

Set `DATABASE_URL` to use `clubos_app` for the running app. Migrations
run as `clubos_admin` (Prisma's shadow database setup).

### Disabling RLS for diagnostics

```bash
psql "$DATABASE_URL" -f prisma/sql/disable-rls.sql
unset CLUBOS_RLS_ENABLED
```

## What's scoped vs not

**Scoped (21 models):** Member, Group, Committee, Event, Invoice,
HouseCharge, Statement, ComplianceCertificate, Task, Feedback,
Reminder, CheckinLog, Conversation, OutboundOptOut, SavedPaymentMethod,
MCPClient, MCPToken, Setting, MediaAsset, WebhookEvent, AuditEvent.

**Not scoped (child / global):** Address, Dependent, GroupMembership,
CommitteeMembership, EventAttendance, Message, InvoiceLine,
Installment, Payment, Refund, CalendarEvent (reach tenant via parent);
User, Account, Session, VerificationToken, MCPAuthorization
(auth-bootstrap, reach tenant via user); Club itself (operators see
all, members see their own).

## Provisioning a new club

```ts
import { prisma } from "@/lib/db";
import { withOperatorScope } from "@/lib/tenantContext";

await withOperatorScope(async () => {
  await prisma.club.create({
    data: { slug: "pinehurst", name: "Pinehurst Country Club" },
  });
});
```

Or via the `/operator/clubs` page when signed in as an OPERATOR.

## Promoting a user to OPERATOR

There is no UI yet (deferred). The shell route:

```sql
UPDATE "User" SET role = 'OPERATOR' WHERE email = 'admin@example.com';
```

## Migrating an existing single-tenant deploy

Existing single-tenant installs have all data already under `clubId =
"default"` via the column defaults. The seed upserts a Club row with
that id. To split:

1. Provision a new Club via `/operator/clubs` or `withOperatorScope`.
2. Re-assign rows: `UPDATE "Member" SET "clubId" = '<new-id>' WHERE
   ...;` (and the cascade-related child tables).
3. Re-assign the relevant Users: `UPDATE "User" SET "clubId" =
   '<new-id>' WHERE ...;`

That's the path. Full data-migration tooling lives in operator-land
because it touches multiple tables transactionally.
