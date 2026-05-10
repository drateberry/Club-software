# Architecture

## Runtime topology

```
                ┌────────────────────┐
                │  Browser / member  │
                └─────────┬──────────┘
                          │ HTTPS
                          ▼
            ┌──────────────────────────────┐
            │  Next.js (App Router, RSC)   │
            │  - server components query    │
            │    Prisma directly            │
            │  - Server Actions for writes  │
            │  - public /pay/* + /checkin   │
            │  - /api/webhooks/stripe       │
            │  - /api/pass/[token] (QR)     │
            └─────┬───────────────────┬─────┘
                  │ Postgres          │ pg-boss queue
                  ▼                   ▼
            ┌──────────┐        ┌─────────────────────┐
            │ Postgres │◀──────▶│ worker.ts (Node)    │
            └──────────┘        │ - email.send         │
                                │ - installment.remind │
                                │ - compliance.remind  │
                                │ - statement.generate │
                                └─────────┬────────────┘
                                          │ SMTP
                                          ▼
                                ┌──────────────────────┐
                                │ SES / Postmark / etc │
                                └──────────────────────┘
```

The web container and the worker container share the same Docker image. They
differ only by entrypoint (`pnpm start` vs `pnpm worker`). They share a
Postgres instance, which is also the pg-boss queue (no Redis, no separate
queue infrastructure).

## Request lifecycle (authed page)

1. Browser requests `/members`.
2. `src/proxy.ts` (Auth.js v5 middleware) checks the session cookie. If
   missing and the path isn't in the public allowlist (`/login`, `/pay`,
   `/checkin`, `/api/webhooks`), redirects to `/login`.
3. The route's Server Component (`src/app/(app)/members/page.tsx`) runs:
   `requireCapability("members.read")` reads the session, evaluates
   role-implied + explicit capabilities (`lib/capabilities.ts`), and either
   continues or redirects to `/`.
4. The Server Component queries Prisma directly and renders.
5. Mutations submit to a Server Action in the same directory (`actions.ts`).
   Each action: `requireCapability` → Zod validate → Prisma write →
   `logAudit` → `revalidatePath` → `redirect(?ok=…)` for the toast.
6. Toaster reads `?ok=` / `?err=` from `useSearchParams`, renders, and
   replaces the URL to clear the param.

## Request lifecycle (Stripe payment)

1. Member opens `/pay/{paymentToken}`. Public page, no auth.
2. They pick a plan (full / 3 / 8) — Server Action calls
   `applyInstallmentPlan` which materialises `Installment` rows.
3. Click "Pay now". Server Action `payInstallment` calls
   `ensureInstallmentPaymentLink`: lazy creation of a Stripe Checkout
   session, with `metadata: { installmentId, invoiceId }`.
4. Member redirected to `https://checkout.stripe.com/...`. Pays.
5. Stripe POSTs `checkout.session.completed` to
   `/api/webhooks/stripe`. Handler:
   - verifies the signature
   - dedupes via the unique `(providerName, providerEventId)` index on
     `WebhookEvent`
   - reads `metadata.installmentId` and calls `markInstallmentPaid`
   - if all installments paid, the invoice flips to PAID
6. Member returns via `successUrl` to `/pay/{token}` and sees the updated
   state.

## Where data lives

- **Members, groups, committees, events, invoices, charges** — Postgres
  (via Prisma). Schema in `prisma/schema.prisma`.
- **Sessions** — Postgres via `Session` / `Account` / `VerificationToken`
  Auth.js tables.
- **Settings** (club name, locale, branding, email From, etc.) — Postgres
  `Setting` table, accessed through `lib/settings.ts`.
- **Background jobs** — Postgres `pgboss` schema, managed by pg-boss.
- **Webhook idempotency** — Postgres `WebhookEvent` table with unique
  `(providerName, providerEventId)`.
- **Audit log** — Postgres `AuditEvent`.
- **Files (logos, member photos)** — designed for Cloudflare R2 / S3, not
  yet wired in v1 (logo URLs are external strings for now).

## Capability model

Three roles (`ADMIN`, `STAFF`, `MEMBER`) imply baseline capabilities; the
`User.capabilities` JSON column adds explicit ones on top. Capabilities are
strings like `members.write`, `finance.read`, `houseAccounts.write`,
`checkin.scan`, `settings.write`. Defined in `lib/capabilities.ts`.

`requireCapability` is enforced server-side at the action and page level —
the client never decides whether you can do something, only what to render.

## i18n

next-intl with a single locale (`en-US`) shipped. Adding a locale is dropping
a new `messages/{locale}.json` and updating `lib/i18n/request.ts`.

Money + dates flow through `lib/format.ts` which uses the per-club locale,
currency, and timezone settings.

## What the worker does

Schedules:
- `installment.reminder` — daily 09:00. Finds installments due in next 3
  days (PENDING or SENT), generates a Stripe checkout link if missing,
  enqueues an `email.send` job.
- `compliance.reminder` — daily 09:00. Finds certificates expiring in next
  30 days, enqueues an `email.send` job.
- `statement.generate` — 1st of month 06:00. Aggregates the previous
  month's unbilled `HouseCharge` rows into one Invoice (kind=STATEMENT)
  per member. Idempotent via the `Statement (memberId, periodStart)`
  unique index.

The web app can also enqueue jobs directly (e.g. on invoice send).
