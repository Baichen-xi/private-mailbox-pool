import { createId } from "../lib/ids";
import { nowTimestamp } from "../lib/time";

export interface EmailRecord {
  id: string;
  mailbox_id: string;
  from_name: string | null;
  from_address: string;
  to_address: string;
  subject: string | null;
  received_at: string;
  is_read: number;
  has_attachments: number;
  size_bytes: number;
  text_preview: string | null;
}

export interface EmailDetailRecord extends EmailRecord {
  message_id: string | null;
  thread_key: string | null;
  reply_to: string | null;
  html_sanitized: number;
  text_body_r2_key: string | null;
  html_body_r2_key: string | null;
  raw_r2_key: string;
  headers_json: string | null;
  created_at: string;
}

export interface EmailInsertArgs {
  id?: string;
  mailboxId: string;
  messageId: string | null;
  threadKey: string | null;
  fromName: string | null;
  fromAddress: string;
  toAddress: string;
  replyTo: string | null;
  subject: string | null;
  receivedAt: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  htmlSanitized?: boolean;
  sizeBytes: number;
  textPreview: string | null;
  textBodyR2Key: string | null;
  htmlBodyR2Key: string | null;
  rawR2Key: string;
  headersJson: string | null;
  spamScore?: number | null;
}

export async function listEmailsForMailbox(
  db: D1Database,
  mailboxId: string,
  limit = 50
): Promise<EmailRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         id,
         mailbox_id,
         from_name,
         from_address,
         to_address,
         subject,
         received_at,
         is_read,
         has_attachments,
         size_bytes,
         text_preview
       FROM emails
       WHERE mailbox_id = ?
         AND deleted_at IS NULL
       ORDER BY received_at DESC
       LIMIT ?`
    )
    .bind(mailboxId, limit)
    .all<EmailRecord>();

  return result.results ?? [];
}

export async function findEmailByMailboxAndMessageId(
  db: D1Database,
  mailboxId: string,
  messageId: string
): Promise<EmailRecord | null> {
  return db
    .prepare(
      `SELECT
         id,
         mailbox_id,
         from_name,
         from_address,
         to_address,
         subject,
         received_at,
         is_read,
         has_attachments,
         size_bytes,
         text_preview
       FROM emails
       WHERE mailbox_id = ?
         AND message_id = ?
         AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(mailboxId, messageId)
    .first<EmailRecord>();
}

export async function getEmailById(
  db: D1Database,
  mailboxId: string,
  emailId: string
): Promise<EmailDetailRecord | null> {
  return db
    .prepare(
      `SELECT
         id,
         mailbox_id,
         message_id,
         thread_key,
         from_name,
         from_address,
         to_address,
         reply_to,
         subject,
         received_at,
         is_read,
         has_attachments,
         html_sanitized,
         size_bytes,
         text_preview,
         text_body_r2_key,
         html_body_r2_key,
         raw_r2_key,
         headers_json,
         created_at
       FROM emails
       WHERE mailbox_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(mailboxId, emailId)
    .first<EmailDetailRecord>();
}

export async function markEmailAsRead(
  db: D1Database,
  mailboxId: string,
  emailId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE emails
       SET is_read = 1,
           updated_at = ?
       WHERE mailbox_id = ?
         AND id = ?
         AND is_read = 0
         AND deleted_at IS NULL`
    )
    .bind(nowTimestamp(), mailboxId, emailId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function markEmailsAsRead(
  db: D1Database,
  mailboxId: string,
  emailIds: string[]
): Promise<number> {
  if (emailIds.length === 0) {
    return 0;
  }

  const placeholders = emailIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `UPDATE emails
       SET is_read = 1,
           updated_at = ?
       WHERE mailbox_id = ?
         AND id IN (${placeholders})
         AND is_read = 0
         AND deleted_at IS NULL`
    )
    .bind(nowTimestamp(), mailboxId, ...emailIds)
    .run();

  return result.meta?.changes ?? 0;
}

export async function softDeleteEmails(
  db: D1Database,
  mailboxId: string,
  emailIds: string[]
): Promise<number> {
  if (emailIds.length === 0) {
    return 0;
  }

  const placeholders = emailIds.map(() => "?").join(", ");
  const timestamp = nowTimestamp();
  const result = await db
    .prepare(
      `UPDATE emails
       SET deleted_at = ?,
           updated_at = ?
       WHERE mailbox_id = ?
         AND id IN (${placeholders})
         AND deleted_at IS NULL`
    )
    .bind(timestamp, timestamp, mailboxId, ...emailIds)
    .run();

  return result.meta?.changes ?? 0;
}

export async function createEmailRecord(
  db: D1Database,
  args: EmailInsertArgs
): Promise<{ id: string }> {
  const id = args.id ?? createId();

  await db
    .prepare(
      `INSERT INTO emails (
         id,
         mailbox_id,
         message_id,
         thread_key,
         from_name,
         from_address,
         to_address,
         reply_to,
         subject,
         received_at,
         is_read,
         has_attachments,
         html_sanitized,
         size_bytes,
         text_preview,
         text_body_r2_key,
         html_body_r2_key,
         raw_r2_key,
         headers_json,
         spam_score,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      args.mailboxId,
      args.messageId,
      args.threadKey,
      args.fromName,
      args.fromAddress,
      args.toAddress,
      args.replyTo,
      args.subject,
      args.receivedAt,
      args.isRead ? 1 : 0,
      args.hasAttachments ? 1 : 0,
      args.htmlSanitized ? 1 : 0,
      args.sizeBytes,
      args.textPreview,
      args.textBodyR2Key,
      args.htmlBodyR2Key,
      args.rawR2Key,
      args.headersJson,
      args.spamScore ?? null,
      nowTimestamp(),
      nowTimestamp()
    )
    .run();

  return { id };
}
