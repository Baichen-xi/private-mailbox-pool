import { createId } from "../lib/ids";
import { nowTimestamp } from "../lib/time";

export type MailboxStatus = "active" | "paused" | "archived" | "deleted";

export interface MailboxRecord {
  id: string;
  local_part: string;
  subdomain_id: string;
  full_address: string;
  status: MailboxStatus;
  note: string | null;
  retention_mode: "keep_forever" | "delete_after_days";
  retention_days: number | null;
  last_received_at: string | null;
  total_email_count: number;
  unread_email_count: number;
  created_at: string;
  subdomain_label?: string;
  full_domain?: string;
}

export interface MailboxInsertArgs {
  id?: string;
  localPart: string;
  subdomainId: string;
  fullAddress: string;
  note: string | null;
  retentionMode?: "keep_forever" | "delete_after_days";
  retentionDays?: number | null;
}

export async function createMailbox(
  db: D1Database,
  args: MailboxInsertArgs
): Promise<{ id: string }> {
  const id = args.id ?? createId();
  await db
    .prepare(
      `INSERT INTO mailboxes (
         id, local_part, subdomain_id, full_address, status, note, retention_mode, retention_days, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      args.localPart,
      args.subdomainId,
      args.fullAddress,
      args.note,
      args.retentionMode ?? "keep_forever",
      args.retentionDays ?? null,
      nowTimestamp(),
      nowTimestamp()
    )
    .run();

  return { id };
}

export async function listMailboxes(
  db: D1Database,
  limit = 100
): Promise<MailboxRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         mailboxes.id,
         mailboxes.local_part,
         mailboxes.subdomain_id,
         mailboxes.full_address,
         mailboxes.status,
         mailboxes.note,
         mailboxes.retention_mode,
         mailboxes.retention_days,
         mailboxes.last_received_at,
         mailboxes.total_email_count,
         mailboxes.unread_email_count,
         mailboxes.created_at,
         subdomains.subdomain_label,
         subdomains.full_domain
       FROM mailboxes
       INNER JOIN subdomains ON subdomains.id = mailboxes.subdomain_id
       WHERE mailboxes.deleted_at IS NULL
       ORDER BY mailboxes.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<MailboxRecord>();

  return result.results ?? [];
}

export async function getMailboxById(
  db: D1Database,
  mailboxId: string
): Promise<MailboxRecord | null> {
  return db
    .prepare(
      `SELECT
         mailboxes.id,
         mailboxes.local_part,
         mailboxes.subdomain_id,
         mailboxes.full_address,
         mailboxes.status,
         mailboxes.note,
         mailboxes.retention_mode,
         mailboxes.retention_days,
         mailboxes.last_received_at,
         mailboxes.total_email_count,
         mailboxes.unread_email_count,
         mailboxes.created_at,
         subdomains.subdomain_label,
         subdomains.full_domain
       FROM mailboxes
       INNER JOIN subdomains ON subdomains.id = mailboxes.subdomain_id
       WHERE mailboxes.id = ?
         AND mailboxes.deleted_at IS NULL
       LIMIT 1`
    )
    .bind(mailboxId)
    .first<MailboxRecord>();
}

export async function findMailboxByAddress(
  db: D1Database,
  fullAddress: string
): Promise<MailboxRecord | null> {
  return db
    .prepare(
      `SELECT
         mailboxes.id,
         mailboxes.local_part,
         mailboxes.subdomain_id,
         mailboxes.full_address,
         mailboxes.status,
         mailboxes.note,
         mailboxes.retention_mode,
         mailboxes.retention_days,
         mailboxes.last_received_at,
         mailboxes.total_email_count,
         mailboxes.unread_email_count,
         mailboxes.created_at,
         subdomains.subdomain_label,
         subdomains.full_domain
       FROM mailboxes
       INNER JOIN subdomains ON subdomains.id = mailboxes.subdomain_id
       WHERE LOWER(mailboxes.full_address) = LOWER(?)
         AND mailboxes.deleted_at IS NULL
       LIMIT 1`
    )
    .bind(fullAddress)
    .first<MailboxRecord>();
}

export async function getMailboxSummary(db: D1Database): Promise<{
  total: number;
  active: number;
  paused: number;
}> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused
       FROM mailboxes
       WHERE deleted_at IS NULL`
    )
    .first<{ total: number | string; active: number | string | null; paused: number | string | null }>();

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    paused: Number(row?.paused ?? 0)
  };
}

export async function countExistingMailboxForSubdomain(
  db: D1Database,
  subdomainId: string
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM mailboxes
       WHERE subdomain_id = ?
         AND deleted_at IS NULL`
    )
    .bind(subdomainId)
    .first<{ total: number | string | null }>();

  return Number(row?.total ?? 0);
}

export async function deleteMailboxesWithoutEmails(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM mailboxes
       WHERE deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM emails
           WHERE emails.mailbox_id = mailboxes.id
             AND emails.deleted_at IS NULL
         )`
    )
    .run();

  return result.meta?.changes ?? 0;
}

export async function incrementMailboxCounters(
  db: D1Database,
  mailboxId: string,
  receivedAt: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE mailboxes
       SET total_email_count = total_email_count + 1,
           unread_email_count = unread_email_count + 1,
           last_received_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(receivedAt, nowTimestamp(), mailboxId)
    .run();
}

export async function decrementMailboxUnreadCount(
  db: D1Database,
  mailboxId: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE mailboxes
       SET unread_email_count = CASE
             WHEN unread_email_count > 0 THEN unread_email_count - 1
             ELSE 0
           END,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(nowTimestamp(), mailboxId)
    .run();
}

export async function refreshMailboxEmailCounters(
  db: D1Database,
  mailboxId: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE mailboxes
       SET total_email_count = (
             SELECT COUNT(*)
             FROM emails
             WHERE mailbox_id = ?
               AND deleted_at IS NULL
           ),
           unread_email_count = (
             SELECT COUNT(*)
             FROM emails
             WHERE mailbox_id = ?
               AND is_read = 0
               AND deleted_at IS NULL
           ),
           last_received_at = (
             SELECT MAX(received_at)
             FROM emails
             WHERE mailbox_id = ?
               AND deleted_at IS NULL
           ),
           updated_at = ?
       WHERE id = ?`
    )
    .bind(mailboxId, mailboxId, mailboxId, nowTimestamp(), mailboxId)
    .run();
}
