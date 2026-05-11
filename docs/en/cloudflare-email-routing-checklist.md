# Cloudflare Email Routing Checklist

This checklist is for the first end-to-end inbound mail test after the Worker `email()` handler is in place.

## Current inbound behavior

The Worker now:

- receives mail through `email()`
- matches the inbound recipient against an existing mailbox
- rejects unknown or inactive mailboxes
- stores the raw `.eml` in R2
- stores parsed text and html bodies in R2 when present
- stores email metadata in D1
- stores attachment metadata in D1 and attachment blobs in R2
- increments mailbox totals and unread counts

## Local development test

Cloudflare supports local email handler testing through Wrangler.

1. Start local development:

```bash
npm run dev
```

2. Create a mailbox in the UI, for example:

```text
demo@alpha.example.com
```

3. POST a raw email message to Wrangler's local email endpoint:

```bash
curl -X POST "http://localhost:8787/cdn-cgi/handler/email?from=sender@example.com&to=demo@alpha.example.com" \
  -H "content-type: application/json" \
  --data-binary @sample.eml
```

4. Refresh the mailbox detail page and confirm:

- total email count increased
- unread email count increased
- last received time updated
- the inbox row is visible

## Cloudflare production checklist

### 1. Worker and storage

- create the D1 database
- create the R2 bucket
- update `wrangler.toml` with the real D1 database id
- deploy the Worker
- apply D1 migrations remotely

### 2. Domain and Email Routing

- your domain is active in Cloudflare
- Email Routing is enabled for the zone
- MX records required by Cloudflare Email Routing are present
- SPF records required by Cloudflare Email Routing are present

### 3. Route mail to the Worker

Choose one of these patterns:

- catch-all on the base domain
- specific addresses on the base domain
- addresses on configured subdomains that you intentionally support

For this project's current model, you should only route domains and subdomains that your mailbox pool is meant to accept.

### 4. App configuration

- `BASE_DOMAIN` matches the production domain
- `CLOUDFLARE_ZONE_ID` is added as a plain variable
- `CLOUDFLARE_API_TOKEN` is added as a secret with at least Zone Read, DNS Read, and Email Routing Rules Read
- `BOOTSTRAP_ADMIN_PASSWORD_HASH` or `BOOTSTRAP_ADMIN_PASSWORD_PLAIN` is stored as a secret
- Cloudflare Access is enabled in front of the admin UI for production

### 5. First real inbound test

1. Create a mailbox in the UI.
2. Send a test email from Gmail, QQ Mail, Outlook, or another external mailbox.
3. Confirm the email appears in the matching inbox.
4. Confirm the raw email object exists in R2.
5. Confirm the email row exists in D1.

## Recommended first production test matrix

- active mailbox receives successfully
- unknown mailbox is rejected
- paused mailbox is rejected
- same sender can send multiple messages to the same mailbox
- mailbox under a reusable subdomain still resolves correctly

## Known gaps after this step

These are not blockers for the first inbound test, but they are still upcoming work:

- email detail page
- attachment download UI
- HTML sanitization before rendering
- read/unread mutation actions
- stronger retry and dead-letter behavior for transient failures
