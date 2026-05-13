-- Club OS — Postgres Row-Level Security as defense-in-depth
--
-- The application already auto-scopes every Prisma query via an
-- AsyncLocalStorage tenant context (see src/lib/db.ts). This file
-- adds a second layer: RLS policies the Postgres server enforces
-- regardless of what the application sends. A bug in the app layer
-- can no longer leak cross-tenant data.
--
-- Deployment model:
--   1. Run migrations + this file as a Postgres SUPERUSER (your
--      DATABASE_OWNER / migration role).
--   2. The application connects with a separate role (e.g. clubos_app)
--      that does NOT have BYPASSRLS. CREATE USER clubos_app WITH
--      PASSWORD '...'; GRANT all needed table perms.
--   3. Each request runs `SET LOCAL app.club_id = '<id>'` at the start
--      of its transaction (lib/db.ts does this automatically when a
--      tenant context is active).
--   4. The default-tenant deploy still works because the resolver
--      returns "default" and the OPERATOR scope sets app.club_id = '*'
--      to bypass.
--
-- Apply with:
--   psql "$DATABASE_URL" -f prisma/sql/enable-rls.sql
--
-- Removing RLS (for diagnostics):
--   psql "$DATABASE_URL" -f prisma/sql/disable-rls.sql

BEGIN;

-- Helper function: returns the current tenant id from the connection's
-- session GUC, or NULL if unset. RLS policies use this rather than
-- inlining current_setting() everywhere so it's cheap to swap out.
CREATE OR REPLACE FUNCTION clubos_current_club_id()
RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS
$$
  SELECT current_setting('app.club_id', true);
$$;

-- Bypass marker — operator scope sets this to '*'.
CREATE OR REPLACE FUNCTION clubos_is_operator()
RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS
$$
  SELECT current_setting('app.club_id', true) = '*';
$$;

-- ── Tenant-scoped tables ────────────────────────────────────────────
-- For every table carrying a clubId column, enable RLS and add a
-- single policy that:
--   * Always returns true for the operator scope (app.club_id = '*')
--   * Otherwise: clubId must match the session GUC
--
-- The USING clause covers SELECT / UPDATE / DELETE.
-- WITH CHECK covers INSERT / UPDATE (the row's final state).

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'Member','Group','Committee','Event',
    'Invoice','HouseCharge','Statement','ComplianceCertificate',
    'Task','Feedback','Reminder',
    'CheckinLog','Conversation','OutboundOptOut',
    'SavedPaymentMethod','MCPClient','MCPToken',
    'Setting','MediaAsset','WebhookEvent','AuditEvent',
    'User'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    -- Drop any prior policy with the same name (idempotent re-runs)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING (
          clubos_is_operator()
          OR "clubId" = clubos_current_club_id()
        )
        WITH CHECK (
          clubos_is_operator()
          OR "clubId" = clubos_current_club_id()
        )
    $p$, tbl);
  END LOOP;
END $$;

-- The Club table itself: operators only, plus the owner's own club.
ALTER TABLE "Club" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Club" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self ON "Club";
CREATE POLICY tenant_self ON "Club"
  USING (clubos_is_operator() OR id = clubos_current_club_id())
  WITH CHECK (clubos_is_operator() OR id = clubos_current_club_id());

-- Auth.js tables (Account, Session, VerificationToken) deliberately
-- skip RLS — they're keyed by userId / token and the User table
-- itself carries clubId for tenant attribution. Skipping avoids the
-- chicken-and-egg of needing tenant context during sign-in.

COMMIT;
