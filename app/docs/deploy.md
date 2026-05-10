# Deployment

The production target is **Render**. Other container hosts (Railway, Fly,
Kubernetes) work — the app and worker both come from the single Dockerfile.

## Render checklist for one club

You'll provision these services in Render:

1. **Postgres** — managed Postgres instance. Free tier or starter is fine
   for a club under ~5,000 members.

2. **Web service** (Docker) — running `pnpm db:deploy && pnpm start`
   (the Dockerfile's default CMD).
    - Auto-deploy from `main`
    - Connect the database via `DATABASE_URL`

3. **Background worker** (Docker, same image) — running `pnpm worker`.
    - Auto-deploy from `main`
    - Same `DATABASE_URL`

4. **Cloudflare R2 bucket** (or any S3-compatible) for member photos and
   logos. Connect via `R2_*` env vars (logo upload UI is planned for a
   later round; pre-create the bucket).

## Stripe setup

1. Create a Stripe account in live mode (or test mode for staging).
2. In **Developers → API keys**, get the secret key → set
   `STRIPE_SECRET_KEY`.
3. In **Developers → Webhooks**, add an endpoint:
    - URL: `https://<club-domain>/api/webhooks/stripe`
    - Events: `checkout.session.completed`
    - Get the signing secret → set `STRIPE_WEBHOOK_SECRET`.
4. Test in test mode by creating an invoice in the app, opening the public
   payment URL, paying with `4242 4242 4242 4242`. The invoice should flip
   to PAID via the webhook within seconds.

## Email setup (Amazon SES)

1. Verify the sending domain in SES (DKIM + SPF records).
2. Get out of the SES sandbox if you'll send to non-verified addresses.
3. Create SMTP credentials in **SES → SMTP settings → Create SMTP
   credentials** (these are NOT regular IAM keys).
4. Set `EMAIL_SERVER` to:
   ```
   smtp+ssl://USER:PASS@email-smtp.us-east-1.amazonaws.com:465
   ```
   (region in the hostname matches the region you set up SES in).
5. Set `EMAIL_FROM` to a verified address on the verified domain.
6. Send a test from the worker by triggering `installment.reminder` or
   `compliance.reminder` — emails should appear in the recipient inbox.

## Deploy

CI runs typecheck + lint + build on every PR
(`.github/workflows/club-os-ci.yml`). Once a PR merges to `main`, Render's
auto-deploy triggers. The web container's CMD runs `prisma migrate deploy`
on each deploy, applying any new migrations.

## Provisioning a new club

The path forward is one Render service per club. To add a new club:

1. Pick a subdomain: `clubname.club-os.app` (or the club's own domain).
2. Provision Postgres, web service, worker, R2 bucket as above.
3. Configure env vars per [env-vars.md](env-vars.md).
4. Set up Stripe + SES (each club gets their own Stripe and SES — no
   sharing).
5. After first boot, sign in as `admin@example.com` with the temporary
   password (run `pnpm db:seed --prod` if you want sample data, otherwise
   manually create the first admin via Prisma Studio or a one-off script).
6. Import the member roster via `/settings/import` (CSV).
7. Configure branding (`/settings`), locale (`/settings/locale`), email
   from address (`/settings/email`).

A `bin/provision-club.sh` automating the Render API calls would be a
sensible Phase 6.5 follow-up.

## Backups

Render's managed Postgres has daily backups. For a club paying real money
through the app, set up a parallel `pg_dump` cron uploading to R2 with
encryption — that's a one-line cron job calling
`pg_dump $DATABASE_URL | gzip > /tmp/$(date +%F).sql.gz` then `aws s3 cp`.
Not in the repo yet.
