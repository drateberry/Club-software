# Data model

The full schema lives in [`prisma/schema.prisma`](../prisma/schema.prisma).
This page is a tour, not a reference.

## Money

Every monetary amount is stored as integer cents (`Int`), never `Decimal`,
never `Float`. Currency is a 3-letter code on each `Invoice` row (defaults to
`USD`) so multi-currency clubs are possible later without schema change.

## Soft delete

`Member`, `Group`, `Committee`, `Event` carry `deletedAt`. Audit-relevant
deletes set `deletedAt`; queries filter on `deletedAt: null`. `HouseCharge`,
`Installment`, `Payment`, `WebhookEvent`, `AuditEvent` are hard-delete or
append-only.

## Members and households

```
Member ─┬─ addresses        (1..n; isPrimary chooses default)
        ├─ dependents       (children, etc.)
        ├─ sponsorId        (self-relation: who introduced them)
        ├─ spouseId         (self-relation, unique on each side)
        ├─ groupMemberships (many-to-many via GroupMembership)
        ├─ committeeMemberships
        └─ user             (1:1 to User; pass token + auth lives there)
```

`customFields` is a `Json` column on `Member` (and `Group`) that holds
loosely-typed extras while a column hasn't been promoted yet. Plan to
promote a key once it stabilises.

## Authentication

Auth.js v5 standard four-table layout: `User`, `Account`, `Session`,
`VerificationToken`. We add to `User`:

- `role` (`ADMIN` / `STAFF` / `MEMBER`)
- `capabilities` (Json string array)
- `passToken` (unique, 24-byte hex; encoded into the QR member pass)
- `memberId` (1:1 to `Member`)

## Invoicing

```
Invoice ──┬── lines        (InvoiceLine: description + qty + cents)
          ├── installments (Installment: PENDING/SENT/PAID with sequence)
          ├── payments     (Payment: provider + providerPaymentId unique)
          └── statement    (1:1 — set when this invoice was a STATEMENT run)
```

`Invoice.kind` distinguishes `DUES` / `EVENT` / `STATEMENT` / `ASSESSMENT` /
`OTHER`. `Invoice.status` is `DRAFT` / `SENT` / `PAID` / `VOID`. The
`paymentToken` (auto cuid) is the public token in `/pay/[token]`.

`Installment.providerPaymentId` is unique. This is the reverse-lookup index
that lets the webhook handler do O(1) matching without scanning — the same
pattern the original Mollie integration used in WordPress.

## House accounts

```
HouseCharge ── posted by User, links back to invoiceId once billed
Statement ── (memberId, periodStart) unique; references the generated Invoice
```

`HouseCharge.invoiceId` is null until a statement run rolls it into an
invoice. The unique on `Statement` makes the runner idempotent: re-running a
period skips members already statemented.

## Events and ticketing

```
Event ── publicToken unique  (the /pay/event/[token] guest URL)
      ── attendances (EventAttendance: memberId or guest; status; ticketPaidAt)
```

`EventAttendance` has a unique on `(eventId, memberId)`. Guest attendances
have `memberId: null` and unique-by-id only.

## Compliance

`ComplianceCertificate` is the generic version of the Dutch VOG concept.
Type is a free-text string ("Background Check (Youth Program)", "First Aid",
"Driver's License Verification") so each club can run their own taxonomy.
`expiresOn` drives the 30-day reminder.

## Webhooks

`WebhookEvent (providerName, providerEventId)` is the unique idempotency
index. Every webhook delivery: insert (or short-circuit), do the work,
update `processedAt`. Stripe's own retries are then safe.

## Audit

`AuditEvent` is append-only. `actorId` is nullable so we can record system
events. `diffJson` is opt-in; many actions just record (action, entity,
entityId).
