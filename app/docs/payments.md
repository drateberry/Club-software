# Payments

## Provider abstraction

`lib/payments/provider.ts` defines the interface. Today's only
implementation is `lib/payments/stripe.ts`. Adding Square or Mollie means a
new file, a new branch in `getPaymentProvider()`, no other changes.

```ts
interface PaymentProvider {
  createPaymentLink(args): Promise<{ providerPaymentId, url }>
  parseWebhook(body, signatureHeader): Promise<ProcessedWebhook>
}
```

`ProcessedWebhook` carries a normalized `match`:
- `{ kind: "installment", installmentId, paid, amountCents, method }`
- `{ kind: "invoice", invoiceId, paid, amountCents, method }`
- `{ kind: "event_ticket", attendanceId, paid, amountCents, method }`
- `{ kind: "ignored" }`

The webhook handler at `/api/webhooks/stripe` doesn't know about Stripe; it
asks the provider to parse the body, then dispatches.

## Stripe checkout flow

`createPaymentLink` opens a Stripe Checkout Session (mode: payment, single
line item). Card-only by default; `enableAch: true` adds
`us_bank_account` to `payment_method_types`. Metadata always carries the
internal IDs we'll need on webhook return:

| Use | metadata |
|---|---|
| Installment payment | `installmentId`, `invoiceId` |
| Full invoice payment | `invoiceId` |
| Event ticket (member or guest) | `attendanceId`, `eventId` |

## Installment state machine

Three plans:
- `full` — 1 installment for the full invoice total
- `quarterly_3` — 3 installments, 3 months apart starting at the due date
- `monthly_8` — 8 installments, 1 month apart

Cents are distributed evenly: `Math.floor(total / count)` with the
remainder spread across the first installments so the sum exactly matches
`Invoice.totalCents`.

`Installment.status` lifecycle:

```
PENDING ──(ensureInstallmentPaymentLink)──▶ SENT ──(webhook)──▶ PAID
```

`markInstallmentPaid` is idempotent: if already PAID, returns. Otherwise:

1. Set `Installment.status = PAID`, `paidAt = now()`.
2. Upsert `Payment` keyed by `providerPaymentId` (unique).
3. If all sibling installments are PAID, transition `Invoice` to PAID and
   set `Invoice.paidAt`.

The next installment's payment link is created lazily — on the public
payment page when the member visits, or by the daily reminder worker job.

## Webhook routing (idempotent)

```
Stripe POST /api/webhooks/stripe
  │
  ▼
provider.parseWebhook(body, signature)   verifies signature → throws on bad sig
  │
  ▼
INSERT INTO WebhookEvent (providerName, providerEventId, rawJson)
  on conflict do nothing                 dedupes via unique index
  │
  ▼
match.kind ── installment ─▶ markInstallmentPaid(installmentId, ...)
            ├─ invoice     ─▶ markInvoicePaid(invoiceId, ...)
            ├─ event_ticket ─▶ EventAttendance.ticketPaidAt = now()
            └─ ignored      ─▶ noop
  │
  ▼
UPDATE WebhookEvent SET processedAt = now()
```

If Stripe retries (their infrastructure does retry on 5xx for ~3 days),
the unique constraint on `(providerName, providerEventId)` makes the
second attempt a no-op.

## ACH

Stripe's `us_bank_account` payment method clears in ~3 business days. Card
fees are ~2.9% + $0.30; ACH is $0.80 capped. For a $1,500 dues invoice
that's $44 vs $0.80 — significant. ACH is enabled on installment payment
links by default (`enableAch: true` in `ensureInstallmentPaymentLink`).

Members on the public payment page see "Pay with bank account" alongside
the card option. No code change needed — it's a Stripe Checkout feature
toggled by `payment_method_types`.

## Manual reconciliation

If a webhook is missed (Stripe outage, bad signature), the support flow is:

1. Look up the Stripe payment in their dashboard, get the
   `cs_xxx` (Checkout Session ID) — that's our `providerPaymentId`.
2. In Postgres, find the `Installment` by `providerPaymentId`.
3. Manually call `markInstallmentPaid` from a script, or `UPDATE`
   `Installment.status = 'PAID'` and insert a `Payment` row.

A future job (not in v1) should pull recent Stripe payments and reconcile
against local state.
