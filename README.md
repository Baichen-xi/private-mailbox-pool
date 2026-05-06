# Private Mailbox Pool

Private long-lived inboxes on Cloudflare Workers, D1, and R2.

## Docs

- [Documentation index](./docs/README.md)
- [Schema](./docs/schema.sql)
- [Migration 0001](./migrations/0001_initial.sql)
- [Cloudflare dashboard-first deploy guide (ZH)](./docs/zh/cloudflare-dashboard-deploy-step-by-step.md)

## Milestone 1 status

The repo now includes:

- Worker scaffold
- D1-backed admin login
- Session cookie auth
- Protected dashboard shell
- Bootstrap password hash script
- Mailbox workspace and mailbox detail pages
- Localized Chinese and English UI
- Local inbound email handler with D1 and R2 persistence

Inbound email detail rendering, attachment downloads, and production Email Routing rollout are the next milestones.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create the D1 database and replace `database_id` in [wrangler.toml](./wrangler.toml).

3. Apply the initial migration:

```bash
npx wrangler d1 migrations apply private-mailbox-pool
```

4. Choose a bootstrap admin password mode.

Option A: plain password bootstrap (easier for dashboard-based setup):

Copy `.dev.vars.example` to `.dev.vars` and set:

```text
BOOTSTRAP_ADMIN_PASSWORD_PLAIN=your-strong-password
```

Option B: precomputed password hash:

```bash
npm run hash:password -- "your-strong-password"
```

Then put the generated hash into `BOOTSTRAP_ADMIN_PASSWORD_HASH` in `.dev.vars`.

5. For local development, apply the migration to the local D1 database:

```bash
npx wrangler d1 migrations apply private-mailbox-pool --local
```

6. Start the worker:

```bash
npm run dev
```

7. Open the local URL from Wrangler, then sign in with:

```text
username: admin
password: the bootstrap plain password you set
```

8. Optional: test the inbound email handler locally with Wrangler's email endpoint:

```bash
curl -X POST "http://localhost:8787/cdn-cgi/handler/email?from=sender@example.com&to=demo@example.com" \
  -H "content-type: application/json" \
  --data-binary @sample.eml
```

## Deployment preparation

1. Create the production D1 database:

```bash
npx wrangler d1 create private-mailbox-pool
```

2. Replace `database_id` in [wrangler.toml](./wrangler.toml) with the value returned by Cloudflare.

3. Create the production R2 bucket:

```bash
npx wrangler r2 bucket create private-mailbox-pool-mail
```

4. Add production secrets and variables.

Recommended for dashboard-first deployment:

```bash
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD_PLAIN
```

Or continue using a precomputed hash:

```bash
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD_HASH
```

Do not set both unless you intentionally want the hash to take priority. If both are configured, the worker uses `BOOTSTRAP_ADMIN_PASSWORD_HASH` first, then falls back to `BOOTSTRAP_ADMIN_PASSWORD_PLAIN`.

Bootstrap credentials are intentionally not stored in `wrangler.toml`. Keep them in local `.dev.vars` for development and in Cloudflare Secrets for production.

5. Apply the migration to production:

```bash
npx wrangler d1 migrations apply private-mailbox-pool --remote
```

6. Deploy:

```bash
npm run deploy
```

7. Follow the Cloudflare Email Routing checklist:

- [English checklist](./docs/en/cloudflare-email-routing-checklist.md)
- [中文联调清单](./docs/zh/cloudflare-email-routing-checklist.md)

## Bootstrap behavior

On the first successful login attempt, the worker checks whether the bootstrap admin exists in D1. If it does not exist and either `BOOTSTRAP_ADMIN_PASSWORD_HASH` or `BOOTSTRAP_ADMIN_PASSWORD_PLAIN` is configured, the worker inserts the bootstrap admin row automatically.

This is intended for the first admin only. After the first login, you can rotate credentials in the database and remove the bootstrap secret from local config or Cloudflare.
