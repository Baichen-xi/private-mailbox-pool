import { createId } from "../lib/ids";
import { nowTimestamp } from "../lib/time";

export interface MailboxGroupRecord {
  id: string;
  name: string;
  color: string;
  created_at: string;
  mailbox_count?: number;
}

export async function listMailboxGroups(db: D1Database, limit = 100): Promise<MailboxGroupRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         mailbox_groups.id,
         mailbox_groups.name,
         mailbox_groups.color,
         mailbox_groups.created_at,
         (
           SELECT COUNT(*)
           FROM mailboxes
           WHERE mailboxes.group_id = mailbox_groups.id
             AND mailboxes.deleted_at IS NULL
         ) AS mailbox_count
       FROM mailbox_groups
       ORDER BY mailbox_groups.created_at ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<MailboxGroupRecord>();

  return result.results ?? [];
}

export async function getMailboxGroupById(
  db: D1Database,
  groupId: string
): Promise<MailboxGroupRecord | null> {
  return db
    .prepare(
      `SELECT id, name, color, created_at
       FROM mailbox_groups
       WHERE id = ?
       LIMIT 1`
    )
    .bind(groupId)
    .first<MailboxGroupRecord>();
}

export async function createMailboxGroup(
  db: D1Database,
  args: { name: string; color?: string }
): Promise<MailboxGroupRecord> {
  const id = createId();
  const color = args.color || "#156f5b";
  const timestamp = nowTimestamp();
  await db
    .prepare(
      `INSERT INTO mailbox_groups (id, name, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, args.name, color, timestamp, timestamp)
    .run();

  return {
    id,
    name: args.name,
    color,
    created_at: timestamp
  };
}

export async function updateMailboxGroup(
  db: D1Database,
  groupId: string,
  args: { name: string; color: string }
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE mailbox_groups
       SET name = ?,
           color = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(args.name, args.color, nowTimestamp(), groupId)
    .run();

  return result.meta?.changes ?? 0;
}

export async function countMailboxesInGroup(db: D1Database, groupId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM mailboxes
       WHERE group_id = ?
         AND deleted_at IS NULL`
    )
    .bind(groupId)
    .first<{ total: number | string | null }>();

  return Number(row?.total ?? 0);
}

export async function deleteMailboxGroupById(db: D1Database, groupId: string): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM mailbox_groups
       WHERE id = ?`
    )
    .bind(groupId)
    .run();

  return result.meta?.changes ?? 0;
}
