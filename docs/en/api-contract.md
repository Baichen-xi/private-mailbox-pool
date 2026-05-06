# API Contract

This document defines the MVP HTTP contract for the private mailbox pool. All endpoints are served from the Cloudflare Worker under `/api`.

## Conventions

- Response body is JSON unless otherwise noted.
- Timestamps use ISO 8601 UTC strings.
- IDs use ULID or UUIDv7.
- Authenticated admin requests use a secure session cookie.
- Mailbox token requests use `Authorization: Bearer <token>`.
- Errors use the same shape everywhere:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username or password is incorrect."
  }
}
```

## Auth

### `POST /api/auth/login`

Authenticates the admin and creates a session.

Request:

```json
{
  "username": "admin",
  "password": "plain-text-password"
}
```

Success `200`:

```json
{
  "ok": true,
  "session": {
    "expiresAt": "2026-05-07T08:00:00Z"
  }
}
```

Failure codes:
- `INVALID_CREDENTIALS`
- `LOGIN_BLOCKED`
- `RATE_LIMITED`

### `POST /api/auth/logout`

Revokes the current session.

Success `200`:

```json
{ "ok": true }
```

### `GET /api/session`

Returns the current admin session and top-level permissions.

Success `200`:

```json
{
  "authenticated": true,
  "admin": {
    "id": "01J...",
    "username": "admin"
  },
  "security": {
    "cloudflareAccessRequired": true
  }
}
```

## Dashboard

### `GET /api/dashboard`

Returns top-level metrics and recent events.

Success `200`:

```json
{
  "stats": {
    "mailboxCount": 12,
    "activeMailboxCount": 10,
    "unreadEmailCount": 8,
    "availableSubdomainCount": 34
  },
  "recentEmails": [
    {
      "id": "01J...",
      "mailboxId": "01J...",
      "subject": "Verify your account",
      "fromAddress": "noreply@example.org",
      "receivedAt": "2026-05-06T09:32:12Z"
    }
  ],
  "securityAlerts": [
    {
      "id": "01J...",
      "level": "warning",
      "message": "5 failed login attempts from 1 IP in the last hour."
    }
  ]
}
```

## Mailboxes

### `GET /api/mailboxes`

Returns paginated mailboxes.

Query params:
- `q`
- `status`
- `cursor`
- `limit`

Success `200`:

```json
{
  "items": [
    {
      "id": "01J...",
      "localPart": "hello",
      "fullAddress": "hello@a1b2.example.com",
      "status": "active",
      "note": "GitHub signup",
      "retentionMode": "keep_forever",
      "lastReceivedAt": "2026-05-06T09:32:12Z",
      "totalEmailCount": 14,
      "unreadEmailCount": 2,
      "createdAt": "2026-05-01T08:00:00Z"
    }
  ],
  "nextCursor": null
}
```

### `POST /api/mailboxes`

Creates a mailbox and assigns an available subdomain.

Request:

```json
{
  "localPartMode": "custom",
  "localPart": "hello",
  "note": "GitHub signup",
  "retentionMode": "keep_forever",
  "retentionDays": null
}
```

Rules:
- `localPartMode` can be `random` or `custom`.
- If `custom`, `localPart` is required.
- The system assigns the next available subdomain automatically.

Success `201`:

```json
{
  "mailbox": {
    "id": "01J...",
    "fullAddress": "hello@a1b2.example.com",
    "status": "active"
  }
}
```

Failure codes:
- `NO_SUBDOMAIN_AVAILABLE`
- `LOCAL_PART_TAKEN`
- `INVALID_LOCAL_PART`
- `RATE_LIMITED`

### `GET /api/mailboxes/:id`

Returns one mailbox and current subdomain metadata.

### `PATCH /api/mailboxes/:id`

Updates mailbox metadata.

Request:

```json
{
  "status": "paused",
  "note": "Do not use this week",
  "retentionMode": "delete_after_days",
  "retentionDays": 30
}
```

### `DELETE /api/mailboxes/:id`

Soft-deletes a mailbox. Raw objects in R2 remain until background cleanup completes.

Success `200`:

```json
{ "ok": true }
```

### `POST /api/mailboxes/:id/tokens`

Creates a mailbox access token for read-only or read-write access.

Request:

```json
{
  "tokenName": "Desktop viewer",
  "scope": "read",
  "expiresAt": null
}
```

Success `201`:

```json
{
  "token": {
    "id": "01J...",
    "plainText": "mbx_live_...",
    "scope": "read"
  }
}
```

## Emails

### `GET /api/mailboxes/:id/emails`

Returns paginated email summaries for a mailbox.

Query params:
- `cursor`
- `limit`
- `q`
- `unreadOnly`

Success `200`:

```json
{
  "items": [
    {
      "id": "01J...",
      "subject": "Verify your account",
      "fromName": "GitHub",
      "fromAddress": "noreply@github.com",
      "receivedAt": "2026-05-06T09:32:12Z",
      "isRead": false,
      "hasAttachments": false,
      "textPreview": "Please verify your email address..."
    }
  ],
  "nextCursor": null
}
```

### `GET /api/emails/:id`

Returns one email with sanitized content references.

Success `200`:

```json
{
  "email": {
    "id": "01J...",
    "mailboxId": "01J...",
    "subject": "Verify your account",
    "fromName": "GitHub",
    "fromAddress": "noreply@github.com",
    "toAddress": "hello@a1b2.example.com",
    "receivedAt": "2026-05-06T09:32:12Z",
    "isRead": false,
    "textBody": "Please verify your email address...",
    "htmlBody": "<p>Please verify your email address...</p>",
    "headers": {
      "message-id": "<...>"
    },
    "attachments": [
      {
        "id": "01J...",
        "filename": "invoice.pdf",
        "contentType": "application/pdf",
        "sizeBytes": 10240
      }
    ]
  }
}
```

### `PATCH /api/emails/:id/read`

Marks an email read or unread.

Request:

```json
{
  "isRead": true
}
```

### `DELETE /api/emails/:id`

Soft-deletes a single email.

### `GET /api/emails/:id/raw`

Downloads the raw `.eml` payload.

Response:
- `200 text/plain` or `message/rfc822`

### `GET /api/emails/:id/attachments/:attachmentId`

Streams one attachment from R2.

Response:
- `200` with attachment bytes

## Subdomains

### `GET /api/subdomains`

Returns the current subdomain pool.

Query params:
- `status`
- `cursor`
- `limit`

### `POST /api/subdomains/generate`

Generates a batch of subdomains and stores them in the pool.

Request:

```json
{
  "count": 50,
  "labelLength": 4
}
```

Success `201`:

```json
{
  "createdCount": 50
}
```

### `PATCH /api/subdomains/:id`

Allows disabling or reserving a subdomain.

Request:

```json
{
  "status": "disabled",
  "note": "Used by a service that blocked it"
}
```

### `POST /api/subdomains/rebalance`

Ensures the pool has at least the configured minimum available count.

## Settings

### `GET /api/settings`

Returns grouped app settings.

### `PATCH /api/settings`

Updates supported settings only.

Request:

```json
{
  "mail": {
    "allowCustomLocalPart": true,
    "maxAttachmentSizeMb": 10
  },
  "security": {
    "maxLoginFailures": 10,
    "loginBlockMinutes": 15
  }
}
```

## Audit Logs

### `GET /api/audit-logs`

Returns paginated audit events.

Query params:
- `action`
- `targetType`
- `cursor`
- `limit`

Success `200`:

```json
{
  "items": [
    {
      "id": "01J...",
      "action": "mailbox.created",
      "actorType": "admin",
      "actorId": "01J...",
      "targetType": "mailbox",
      "targetId": "01J...",
      "ipAddress": "203.0.113.8",
      "createdAt": "2026-05-06T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```

## Worker-only inbound email flow

### `email(message, env, ctx)`

This is not a public HTTP endpoint. Cloudflare Email Routing invokes the Worker with an inbound message.

Required processing steps:

1. Resolve the `to` address to a mailbox.
2. Reject if mailbox is missing or paused.
3. Parse MIME safely.
4. Store raw payload in R2.
5. Store text body, sanitized HTML body, and attachment objects in R2.
6. Insert metadata rows in D1.
7. Update mailbox counters.
8. Write an `email.received` audit log entry.
