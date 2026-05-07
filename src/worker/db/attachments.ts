import { createId } from "../lib/ids";

export interface AttachmentRecord {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  content_disposition: string | null;
  cid: string | null;
  size_bytes: number;
  r2_key: string;
}

export interface AttachmentInsertArgs {
  emailId: string;
  filename: string;
  contentType: string;
  contentDisposition: string | null;
  contentId: string | null;
  sizeBytes: number;
  r2Key: string;
}

export async function createAttachmentRecord(
  db: D1Database,
  args: AttachmentInsertArgs
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO attachments (
         id,
         email_id,
         filename,
         content_type,
         content_disposition,
         cid,
         size_bytes,
         r2_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId(),
      args.emailId,
      args.filename,
      args.contentType,
      args.contentDisposition,
      args.contentId,
      args.sizeBytes,
      args.r2Key
    )
    .run();
}

export async function listAttachmentsForEmail(
  db: D1Database,
  emailId: string
): Promise<AttachmentRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         id,
         email_id,
         filename,
         content_type,
         content_disposition,
         cid,
         size_bytes,
         r2_key
       FROM attachments
       WHERE email_id = ?
       ORDER BY created_at ASC`
    )
    .bind(emailId)
    .all<AttachmentRecord>();

  return result.results ?? [];
}

export async function getAttachmentById(
  db: D1Database,
  emailId: string,
  attachmentId: string
): Promise<AttachmentRecord | null> {
  return db
    .prepare(
      `SELECT
         id,
         email_id,
         filename,
         content_type,
         content_disposition,
         cid,
         size_bytes,
         r2_key
       FROM attachments
       WHERE email_id = ?
         AND id = ?
       LIMIT 1`
    )
    .bind(emailId, attachmentId)
    .first<AttachmentRecord>();
}

export async function listAttachmentKeysForMailbox(
  db: D1Database,
  mailboxId: string
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT attachments.r2_key
       FROM attachments
       INNER JOIN emails ON emails.id = attachments.email_id
       WHERE emails.mailbox_id = ?`
    )
    .bind(mailboxId)
    .all<{ r2_key: string }>();

  return Array.from(new Set((result.results ?? []).map((item) => item.r2_key).filter(Boolean)));
}
