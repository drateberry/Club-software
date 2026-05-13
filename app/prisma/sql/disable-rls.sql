-- Disable RLS on every Club OS tenant-scoped table. Use for diagnostics
-- when an RLS policy is blocking a query you expect to succeed. Re-enable
-- with prisma/sql/enable-rls.sql.

BEGIN;

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
    'User','Club'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

COMMIT;
