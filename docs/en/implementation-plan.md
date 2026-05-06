# Implementation Plan

## Milestone 1: private shell

Goal:
- Get a secure app shell online with no inbound mail yet.

Scope:
- Wrangler project setup
- D1 migration runner
- Admin bootstrap command
- Login page
- Session cookie auth
- Dashboard shell

Definition of done:
- Cloudflare Access protects the app
- Admin can log in and log out
- Unauthorized users cannot reach app pages

## Milestone 2: mailbox management

Goal:
- Create and manage long-lived mailboxes safely.

Scope:
- Subdomain pool generation
- Mailbox CRUD
- Notes and retention settings
- Audit logs for admin actions
- Rate limiting on mailbox creation

Definition of done:
- Admin can create, pause, archive, and delete mailboxes
- System auto-assigns an available subdomain
- Every mailbox action leaves an audit trail

## Milestone 3: inbound mail

Goal:
- Receive real emails and persist them correctly.

Scope:
- Email Routing worker entrypoint
- MIME parsing
- HTML sanitization
- R2 storage for raw email and attachments
- D1 metadata writes
- Inbox counters

Definition of done:
- Real external emails appear in the right mailbox
- Raw `.eml`, text, html, and attachments are stored
- Paused mailboxes reject inbound mail cleanly

## Milestone 4: reading experience

Goal:
- Make the app pleasant for daily use.

Scope:
- Inbox page
- Email detail page
- Search and filters
- Copy code / copy links helpers
- Download raw email and attachments

Definition of done:
- Admin can quickly find and read any saved mail
- HTML emails render safely
- Attachments download reliably

## Milestone 5: hardening

Goal:
- Reduce the risk of brute force and misuse.

Scope:
- Failed login tracking
- IP blocking windows
- Worker-side rate limiting
- Audit log filters
- Security alerts on dashboard

Definition of done:
- Repeated failed logins trigger temporary blocking
- High-volume mailbox creation is throttled
- Suspicious behavior is visible in the UI
