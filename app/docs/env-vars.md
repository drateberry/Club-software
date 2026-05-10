# Environment variables

`.env.example` ships a populated template. Copy to `.env.local` for Next dev
and `.env` for Prisma CLI; Render reads from the dashboard.

## Database

| Var | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string. Used by both Prisma and pg-boss. Format: `postgresql://user:pass@host:5432/dbname?schema=public` |

## Authentication

| Var | Description |
|---|---|
| `AUTH_SECRET` | 32+ byte random secret used by Auth.js for JWT signing. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Public URL of the app, e.g. `https://pinehurst.club-os.app`. Required for Auth.js callback URLs. |

## Email (magic-link sign-in + worker reminders)

| Var | Description |
|---|---|
| `EMAIL_SERVER` | SMTP URL. Dev: `smtp://localhost:1025` (Mailpit). Prod (SES): `smtp+ssl://USER:PASS@email-smtp.us-east-1.amazonaws.com:465`. |
| `EMAIL_FROM` | Default From address, e.g. `Pinehurst Country Club <noreply@pinehurst.club>`. Override per-club via the Setting table. |

## Payments (Stripe)

| Var | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key. Test keys start `sk_test_`, live keys `sk_live_`. |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (currently unused on the server; reserved for future client-side Stripe Elements). |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from `/webhooks` endpoint config. |

## File storage (Cloudflare R2 / S3-compatible)

Currently reserved for future logo and photo uploads. App boots without
them set.

| Var | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID. |
| `R2_ACCESS_KEY_ID` | R2 access key. |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key. |
| `R2_BUCKET` | Bucket name. |
| `R2_PUBLIC_URL` | Public-read base URL of the bucket. |

## Per-club configuration

These have Setting-table equivalents that override env at runtime. Treat
the env vars as defaults for first boot.

| Var | Description |
|---|---|
| `CLUB_NAME` | Display name across the UI and emails. |
| `CLUB_LOCALE` | BCP 47 tag for date/number formatting (e.g. `en-US`). |
| `CLUB_CURRENCY` | 3-letter ISO 4217 (e.g. `USD`). |
| `CLUB_TIMEZONE` | IANA timezone (e.g. `America/New_York`). Used by the worker for cron cutoffs and by formatters. |
| `CLUB_PUBLIC_URL` | Canonical public URL of this club's install. Used to build payment links and QR pass URLs. Must match `AUTH_URL`. |

## AWS (reserved)

`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` exist in
`.env.example` for a future direct-SES path (currently we go through SMTP,
which is simpler and works the same).
