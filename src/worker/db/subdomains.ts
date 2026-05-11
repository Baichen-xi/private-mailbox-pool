import { createId } from "../lib/ids";
import { nowTimestamp } from "../lib/time";

export type SubdomainStatus = "available" | "assigned" | "reserved" | "disabled";
export type SubdomainVerificationStatus = "verified" | "unverified" | "invalid";

export interface SubdomainRecord {
  id: string;
  subdomain_label: string;
  full_domain: string;
  status: SubdomainStatus;
  verification_status: SubdomainVerificationStatus;
  assigned_mailbox_id: string | null;
  note: string | null;
  created_at: string;
  assigned_at: string | null;
  mailbox_count?: number;
}

export interface SubdomainSummary {
  total: number;
  available: number;
  assigned: number;
  disabled: number;
  verified: number;
  unverified: number;
  invalid: number;
}

export async function listSubdomains(
  db: D1Database,
  limit = 50
): Promise<SubdomainRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         subdomains.id,
         subdomains.subdomain_label,
         subdomains.full_domain,
         subdomains.status,
         subdomains.verification_status,
         subdomains.assigned_mailbox_id,
         subdomains.note,
         subdomains.created_at,
         subdomains.assigned_at,
         (
           SELECT COUNT(*)
           FROM mailboxes
           WHERE mailboxes.subdomain_id = subdomains.id
             AND mailboxes.deleted_at IS NULL
         ) AS mailbox_count
       FROM subdomains
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<SubdomainRecord>();

  return result.results ?? [];
}

export async function getSubdomainSummary(db: D1Database): Promise<SubdomainSummary> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status != 'disabled' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verified,
         SUM(CASE WHEN verification_status = 'unverified' THEN 1 ELSE 0 END) AS unverified,
         SUM(CASE WHEN verification_status = 'invalid' THEN 1 ELSE 0 END) AS invalid,
         (
           SELECT COUNT(DISTINCT subdomain_id)
           FROM mailboxes
           WHERE deleted_at IS NULL
         ) AS assigned,
         SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) AS disabled
       FROM subdomains`
    )
    .first<{
      total: number | string;
      available: number | string | null;
      assigned: number | string | null;
      disabled: number | string | null;
      verified: number | string | null;
      unverified: number | string | null;
      invalid: number | string | null;
    }>();

  return {
    total: Number(row?.total ?? 0),
    available: Number(row?.available ?? 0),
    assigned: Number(row?.assigned ?? 0),
    disabled: Number(row?.disabled ?? 0),
    verified: Number(row?.verified ?? 0),
    unverified: Number(row?.unverified ?? 0),
    invalid: Number(row?.invalid ?? 0)
  };
}

export async function getSubdomainById(
  db: D1Database,
  subdomainId: string
): Promise<SubdomainRecord | null> {
  return db
    .prepare(
      `SELECT id, subdomain_label, full_domain, status, verification_status, assigned_mailbox_id, note, created_at, assigned_at
       FROM subdomains
       WHERE id = ?
       LIMIT 1`
    )
    .bind(subdomainId)
    .first<SubdomainRecord>();
}

export async function findAvailableSubdomain(db: D1Database): Promise<SubdomainRecord | null> {
  const result = await db
    .prepare(
      `SELECT id, subdomain_label, full_domain, status, verification_status, assigned_mailbox_id, note, created_at, assigned_at
       FROM subdomains
       WHERE status != 'disabled'
         AND verification_status != 'invalid'`
    )
    .all<SubdomainRecord>();

  const items = result.results ?? [];
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

export async function findSubdomainByIdForMailboxCreation(
  db: D1Database,
  subdomainId: string
): Promise<SubdomainRecord | null> {
  return db
    .prepare(
      `SELECT id, subdomain_label, full_domain, status, verification_status, assigned_mailbox_id, note, created_at, assigned_at
       FROM subdomains
       WHERE id = ?
         AND status != 'disabled'
         AND verification_status != 'invalid'
       LIMIT 1`
    )
    .bind(subdomainId)
    .first<SubdomainRecord>();
}

export async function countSubdomainsInUse(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT subdomain_id) AS total
       FROM mailboxes
       WHERE deleted_at IS NULL`
    )
    .first<{ total: number | string | null }>();

  return Number(row?.total ?? 0);
}

export async function deleteUnusedSubdomains(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM subdomains
       WHERE NOT EXISTS (
         SELECT 1
         FROM mailboxes
         WHERE mailboxes.subdomain_id = subdomains.id
           AND mailboxes.deleted_at IS NULL
       )`
    )
    .run();
  return result.meta?.changes ?? 0;
}

export async function deleteSubdomainById(db: D1Database, subdomainId: string): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM subdomains
       WHERE id = ?`
    )
    .bind(subdomainId)
    .run();

  return result.meta?.changes ?? 0;
}

export async function updateSubdomainVerificationStatus(
  db: D1Database,
  subdomainId: string,
  verificationStatus: SubdomainVerificationStatus
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE subdomains
       SET verification_status = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(verificationStatus, nowTimestamp(), subdomainId)
    .run();

  return result.meta?.changes ?? 0;
}

export async function insertSubdomains(
  db: D1Database,
  fullDomains: Array<{ label: string; fullDomain: string }>
): Promise<number> {
  let createdCount = 0;

  for (const item of fullDomains) {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO subdomains (
           id, subdomain_label, full_domain, status, verification_status, created_at, updated_at
         ) VALUES (?, ?, ?, 'available', 'unverified', ?, ?)`
      )
      .bind(createId(), item.label, item.fullDomain, nowTimestamp(), nowTimestamp())
      .run();

    createdCount += result.meta?.changes ?? 0;
  }

  return createdCount;
}
