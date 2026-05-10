# House accounts

A house account is the running tab a member runs at the clubhouse: dining,
pro shop, guest fees, locker, "other". Charges are entered manually by
staff (no POS integration in v1) and rolled up monthly into a single
statement that the member pays via Stripe.

## Charge entry

`/house-accounts/charge` is the staff-facing form: pick a member from the
dropdown, pick a category, type the amount, optionally add a memo, hit
Save. Optimised for fast entry — no modal, autofocus, keyboard friendly.

Charges live in `HouseCharge`. Categories are a fixed set in v1
(`HOUSE_ACCOUNT_CATEGORIES` in `lib/houseAccounts.ts`); planned to move to
the Setting table once a club asks for custom categories.

## Per-member ledger

`/house-accounts/{memberId}` shows the member's:

- Unbilled charges (deletable while still unbilled)
- Statements (each linked to its Invoice)
- Billed history (read-only, last 50)

A "Add charge" shortcut goes to the entry form pre-scoped to this member.

## Statement runner

`generateStatements(periodStart, periodEnd)` in `lib/houseAccounts.ts`
aggregates unbilled charges in the period per member into one Invoice
(`kind: STATEMENT`) with charges as line items. Each charge's `invoiceId`
is set, so a re-run on the same period skips them.

The runner is idempotent at the (member, periodStart) level via the
`Statement` unique index — you can run twice; the second run skips
members already statemented for that period.

Two ways to trigger it:

**Cron (default):** the worker schedules `statement.generate` for the 1st
of each month at 06:00. It runs `generateStatements(prevMonth)`.

**Manual:** the "Run statement batch" button on `/house-accounts` runs the
same thing for the previous calendar month, gated by a confirm dialog.
Useful when month-1 timing slipped or for catch-up runs.

## Statement payment

A statement Invoice goes through the same `/pay/{token}` flow as any other
invoice, including ACH. Members are emailed the statement when the runner
completes (queued to `invoice.send` — the email implementation lands when
the worker's `email.send` queue processes it).

Late fees are not implemented in v1.

## What's not built (yet)

- Editing charges after entry (only delete)
- Statement late fees
- Auto-charge on file (ACH mandate)
- POS integration (Toast, Square Terminal, Jonas, NorthStar)
- Member-facing statements view at `/profile/statements`
