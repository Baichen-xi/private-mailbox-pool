# App Structure

## Page map

### `/login`

Purpose:
- Gate the app behind an application password after Cloudflare Access succeeds.

Main sections:
- App title and short description
- Username field
- Password field
- Submit button
- Cooldown / blocked notice

### `/`

Purpose:
- Dashboard for daily status.

Main sections:
- Top metrics: mailbox count, unread count, available subdomains
- Recent emails
- Security alerts
- Quick actions: create mailbox, open audit logs, generate subdomains

### `/mailboxes`

Purpose:
- Manage all mailboxes from one place.

Main sections:
- Search bar
- Status filter
- New mailbox button
- Mailbox table or card list
- Actions: copy address, open inbox, pause, archive, delete

### `/mailboxes/:id`

Purpose:
- Inbox view for one mailbox.

Main sections:
- Mailbox header with address, note, status
- Email list pane
- Toolbar: search, unread filter, refresh
- Empty state for no emails

### `/emails/:id`

Purpose:
- Read one email in detail.

Main sections:
- Header: subject, sender, recipient, timestamp
- Actions: mark read, copy code, copy links, download raw email, delete
- Body tabs: text, html, headers
- Attachment list

### `/subdomains`

Purpose:
- Maintain the available subdomain pool.

Main sections:
- Pool summary
- Generate batch form
- Status filter
- Subdomain table with assignment status

### `/settings`

Purpose:
- Edit guardrails and defaults.

Main sections:
- Security settings
- Mail settings
- Pool settings
- Save button

### `/audit-logs`

Purpose:
- Review suspicious activity and system changes.

Main sections:
- Filter bar
- Event table
- Metadata drawer

## Low-fidelity wireframes

### Login

```text
+------------------------------------------------------+
| Private Mailbox Pool                                 |
| Private inboxes backed by Cloudflare                 |
|                                                      |
| Username   [__________________________]              |
| Password   [__________________________]              |
|                                                      |
| [ Sign in ]                                          |
|                                                      |
| Too many failed attempts? Wait 12 minutes.           |
+------------------------------------------------------+
```

### Dashboard

```text
+---------------------------------------------------------------+
| Metrics: [12 mailboxes] [8 unread] [34 subdomains available] |
|---------------------------------------------------------------|
| Quick actions: [New mailbox] [Generate subdomains] [Logs]     |
|---------------------------------------------------------------|
| Recent mail                                                   |
| - Verify your account      noreply@github.com    2 min ago    |
| - Your code is 514283      no-reply@openai.com   9 min ago    |
|---------------------------------------------------------------|
| Security alerts                                                |
| - 5 failed logins from 203.0.113.8 in the last hour           |
+---------------------------------------------------------------+
```

### Mailbox list

```text
+--------------------------------------------------------------------+
| Search [________________]  Status [active v]   [ New mailbox ]     |
|--------------------------------------------------------------------|
| hello@a1b2.example.com   active   2 unread   GitHub signup         |
| shop@z9x8.example.com    paused   0 unread   Payment retries       |
| code@m4n5.example.com    active   1 unread   Testing               |
+--------------------------------------------------------------------+
```

### Mailbox inbox

```text
+-------------------------+------------------------------------------+
| hello@a1b2.example.com  | Search [____________] [Refresh]          |
| Active   14 total       |------------------------------------------|
|-------------------------| Verify your account                      |
| * GitHub                | From: noreply@github.com                 |
|   Verify your account   | Time: 2026-05-06 17:32                  |
|-------------------------|------------------------------------------|
|   OpenAI                | Body preview / open full email           |
|   Your code is 514283   |                                          |
|-------------------------|------------------------------------------|
+-------------------------+------------------------------------------+
```

### Email detail

```text
+--------------------------------------------------------------------+
| Verify your account                                                |
| From: GitHub <noreply@github.com>                                  |
| To: hello@a1b2.example.com                                         |
| Time: 2026-05-06 17:32                                             |
| Actions: [Copy code] [Copy links] [Download .eml] [Delete]         |
|--------------------------------------------------------------------|
| Tabs: [Text] [HTML] [Headers]                                      |
|--------------------------------------------------------------------|
| Please verify your email address by clicking the button below.     |
|                                                                    |
| Attachments                                                        |
| - invoice.pdf                                                      |
+--------------------------------------------------------------------+
```

## Recommended directory structure

```text
.
├── docs/
│   ├── api-contract.md
│   ├── app-structure.md
│   └── schema.sql
├── migrations/
│   └── 0001_initial.sql
├── src/
│   ├── worker/
│   │   ├── index.ts
│   │   ├── env.ts
│   │   ├── router/
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── mailboxes.ts
│   │   │   ├── emails.ts
│   │   │   ├── subdomains.ts
│   │   │   ├── settings.ts
│   │   │   └── audit-logs.ts
│   │   ├── email/
│   │   │   ├── handle-inbound.ts
│   │   │   ├── mime-parser.ts
│   │   │   ├── sanitize-html.ts
│   │   │   └── attachment-store.ts
│   │   ├── auth/
│   │   │   ├── sessions.ts
│   │   │   ├── password.ts
│   │   │   └── rate-limit.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── mailboxes.ts
│   │   │   ├── emails.ts
│   │   │   ├── subdomains.ts
│   │   │   ├── settings.ts
│   │   │   └── audit-logs.ts
│   │   ├── lib/
│   │   │   ├── ids.ts
│   │   │   ├── validation.ts
│   │   │   ├── responses.ts
│   │   │   └── time.ts
│   │   └── types/
│   │       └── api.ts
│   ├── app/
│   │   ├── routes/
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── mailboxes.tsx
│   │   │   ├── mailbox-detail.tsx
│   │   │   ├── email-detail.tsx
│   │   │   ├── subdomains.tsx
│   │   │   ├── settings.tsx
│   │   │   └── audit-logs.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── mailbox/
│   │   │   ├── email/
│   │   │   └── settings/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── shared/
│       ├── constants.ts
│       ├── schemas.ts
│       └── dto.ts
├── public/
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## Build order

1. Apply `schema.sql` as migration `0001_initial.sql`.
2. Implement auth routes and session middleware.
3. Implement mailbox CRUD and subdomain allocation.
4. Implement inbound email handler and R2 persistence.
5. Implement inbox and email detail UI.
6. Add audit logs and rate limiting.
