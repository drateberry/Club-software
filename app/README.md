# Club OS

Member-management application for US country / yacht / golf clubs. Replaces a
Dutch sports-club WordPress theme with a Next.js + Postgres stack. One install
per club; designed for a small fleet of single-tenant deployments.

## Stack

- **Web**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
- **Database**: Postgres 16 + Prisma ORM
- **Auth**: Auth.js v5 (magic link + credentials)
- **Payments**: Stripe Checkout (card + ACH) via a `PaymentProvider` abstraction
- **Email**: any SMTP endpoint via `nodemailer` (Mailpit for dev, SES SMTP / Postmark / Mailgun for prod)
- **Background jobs**: pg-boss (Postgres-backed queue, no extra infra)
- **i18n**: next-intl, English first
- **File storage**: S3-compatible (Cloudflare R2 recommended)

## Quick start

```bash
# 1. Install
pnpm install

# 2. Boot Postgres + Mailpit (dev SMTP UI at http://localhost:8025)
docker compose up -d

# 3. Configure env
cp .env.example .env.local && cp .env.local .env

# 4. Migrate + seed
pnpm db:migrate
pnpm db:seed

# 5. Run the web server and the worker (separate terminals)
pnpm dev
pnpm worker
```

Sign in at <http://localhost:3000/login> with `admin@club.local` / `admin1234`,
or request a magic link.

Mailpit (<http://localhost:8025>) catches all dev email — sign-in links and
job-emitted reminders show up here.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm worker` | pg-boss worker (cron + queues) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint with `--max-warnings=0` |
| `pnpm db:migrate` | Run Prisma migrations in dev |
| `pnpm db:deploy` | Run migrations in production (no shadow DB) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:seed` | Reset domain tables and load fixture data |
| `pnpm db:studio` | Prisma Studio at <http://localhost:5555> |

## Project layout

```
app/
  prisma/
    schema.prisma         Full domain schema
    seed.ts               Fixture loader: admin + 25 members + sample events
  src/
    app/
      (app)/              Authed area (sidebar + capability-gated pages)
      pay/                Public payment surfaces (no auth)
      api/                Webhooks, search, QR, auth handlers
    components/           Sidebar, CommandMenu, Toaster, SubmitButton, ...
    lib/
      auth.ts, db.ts      Auth.js + Prisma singletons
      payments/           PaymentProvider + Stripe + installment state machine
      email/              EmailProvider + SMTP + templates
      jobs/               pg-boss queue setup
      audit.ts            logAudit()
      capabilities.ts     Role + cap helpers
      format.ts           Locale-aware money/date formatters
      settings.ts         Setting table CRUD
      houseAccounts.ts    Statement generator
  worker.ts               pg-boss entrypoint
  Dockerfile              Multi-stage build
  docker-compose.yml      Postgres + Mailpit (dev only)
  docs/                   Operator-facing documentation
```

## Documentation

| Doc | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Stack, runtime layout, request lifecycle, where data lives |
| [docs/data-model.md](docs/data-model.md) | Prisma schema walk-through |
| [docs/payments.md](docs/payments.md) | Stripe + ACH, installment state machine, webhook routing |
| [docs/events.md](docs/events.md) | RSVP + ticketing flow, capacity locking |
| [docs/house-accounts.md](docs/house-accounts.md) | Manual charge entry, monthly statement runner |
| [docs/deploy.md](docs/deploy.md) | Render provisioning checklist, Stripe webhook setup |
| [docs/env-vars.md](docs/env-vars.md) | Every environment variable, what it does |

## Origins

This fork replaces a Dutch WordPress theme (`rondo-club`). The old codebase
remains in the repo under `src/`, `includes/`, `acf-json/` etc. as reference
material for domain logic; the live application is the Next.js project under
`app/`.
