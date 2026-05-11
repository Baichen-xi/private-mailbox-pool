# API Contract

This document reflects the endpoints currently implemented by the Worker. Responses are JSON unless the endpoint downloads mail or attachments. Admin endpoints require the authenticated session cookie.

## Errors

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Unable to continue"
  }
}
```

## Auth

### `POST /api/auth/login`

Request:

```json
{
  "username": "admin",
  "password": "plain-text-password"
}
```

Success `200` with `Set-Cookie`:

```json
{
  "ok": true,
  "session": {
    "expiresAt": "2026-05-07T08:00:00.000Z"
  }
}
```

### `POST /api/auth/logout`

Signs out the current session.

### `GET /api/session`

Returns the current auth state and whether Cloudflare Access is enabled.

## Dashboard And Admin

### `GET /api/dashboard`

Returns mailbox counts, unread mail, available subdomains, and recent security alerts.

### `GET /api/admin/overview`

Returns admin accounts, sessions, login attempts, suspicious IPs, and health checks.

### `POST /api/admin/password`

Changes the current admin password.

### `POST /api/admin/sessions/:id/revoke`

Forces a session to sign out.

### `POST /api/admin/login-attempts/clear`

Request:

```json
{ "ipAddress": "203.0.113.10" }
```

Clears failed login attempts for the IP.

## Subdomain Pool

### `GET /api/subdomains`

Returns subdomains and pool summary.

### `POST /api/subdomains/generate`

Creates random or custom subdomains.

```json
{
  "count": 20,
  "labelLength": 4,
  "customLabels": "vip\nregister"
}
```

### `POST /api/subdomains/:id/verification`

Manually sets verification status.

```json
{ "verificationStatus": "verified" }
```

Allowed values: `verified`, `unverified`, `invalid`.

### `POST /api/subdomains/:id/verify`

Checks DNS MX for the exact subdomain. When Cloudflare Email Routing MX is found, the Worker also tries to use `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` to confirm zone Email Routing settings.

If the Cloudflare API variables are not configured, the endpoint falls back to public DNS only: Cloudflare MX marks it `verified`; no MX marks it `invalid`; non-Cloudflare MX keeps it `unverified`.

### `POST /api/subdomains/verify-all`

Checks all current subdomains. Each result includes `verificationStatus`, `mxRecords`, `routingDetected`, and `apiChecked`.

### `POST /api/subdomains/:id/delete`

Deletes a subdomain. If it has mailboxes, those mailboxes and related storage are deleted too.

### `POST /api/subdomains/delete-all`

Deletes only unused subdomains.

## Mailbox Groups

### `GET /api/mailbox-groups`

Returns groups with active mailbox counts.

### `POST /api/mailbox-groups`

Creates a group.

```json
{
  "name": "registrations",
  "color": "#156f5b"
}
```

### `POST /api/mailbox-groups/:id`

Renames a group or changes its color.

```json
{
  "name": "banking",
  "color": "#7c3aed"
}
```

### `POST /api/mailbox-groups/:id/delete`

Deletes an empty group. Groups with mailboxes return `MAILBOX_GROUP_NOT_EMPTY`.

## Mailboxes

### `GET /api/mailboxes`

Returns mailboxes and summary. Items include `groupId`, `groupName`, `groupColor`, `status`, `note`, and `totalEmailCount`.

### `POST /api/mailboxes`

Creates a mailbox. Empty `subdomainId` uses the random pool; `candidateSubdomainId` can pass the visible candidate from the UI.

```json
{
  "subdomainId": "",
  "candidateSubdomainId": "subdomain-id",
  "groupId": "group-id",
  "localPartMode": "custom",
  "localPart": "hello",
  "note": "GitHub signup"
}
```

If the same address was soft-deleted before, creating it again restores the previous mailbox and mail.

### `GET /api/mailboxes/:id`

Returns mailbox detail.

### `POST /api/mailboxes/:id/metadata`

Updates note and group.

```json
{
  "note": "new note",
  "groupId": "group-id"
}
```

### `POST /api/mailboxes/:id/status`

Pauses or resumes receiving.

```json
{ "status": "paused" }
```

Allowed values: `active`, `paused`, `archived`. Only `active` accepts inbound mail.

### `POST /api/mailboxes/:id/note`

Updates only the note.

### `POST /api/mailboxes/:id/delete`

Deletes a mailbox. Empty mailboxes are hard-deleted; mailboxes with mail are soft-deleted and can be restored by recreating the same address.

### `POST /api/mailboxes/cleanup-empty`

Hard-deletes all mailboxes without mail.

## Emails

### `GET /api/mailboxes/:id/emails`

Returns email summaries for a mailbox.

### `GET /api/mailboxes/:id/emails/:emailId`

Returns email detail, text body, safe HTML preview, and attachment links.

### `POST /api/mailboxes/:id/emails/mark-read`

Bulk marks emails as read.

```json
{ "emailIds": ["email-id"] }
```

### `POST /api/mailboxes/:id/emails/delete`

Bulk soft-deletes emails.

### `GET /api/mailboxes/:id/emails/:emailId/raw`

Downloads the raw `.eml`.

### `GET /api/mailboxes/:id/emails/:emailId/attachments/:attachmentId`

Downloads an attachment.

### `GET /api/mailboxes/:id/emails/:emailId/attachments/:attachmentId/preview`

Previews displayable image attachments.

## Maintenance

### `POST /api/maintenance/run`

Manually runs production maintenance: expired mail cleanup, old soft-deleted mailbox archival, and an R2 orphan object sample scan. Production also runs this daily through the Cron in `wrangler.toml`.

## Health

### `GET /health`

Returns service liveness.
