import { createId } from "../lib/ids";
import { minutesAgoTimestamp } from "../lib/time";

export interface SuspiciousLoginIpSummary {
  ip_address: string;
  failed_count: number;
  last_attempt_at: string;
  usernames: string | null;
}

export async function countRecentFailedAttempts(
  db: D1Database,
  ipAddress: string,
  withinMinutes: number
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM login_attempts
       WHERE ip_address = ?
         AND was_successful = 0
         AND created_at >= ?`
    )
    .bind(ipAddress, minutesAgoTimestamp(withinMinutes))
    .first<{ total: number | string }>();

  return Number(row?.total ?? 0);
}

export async function recordLoginAttempt(
  db: D1Database,
  args: {
    ipAddress: string;
    username: string;
    wasSuccessful: boolean;
    failureReason: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO login_attempts (
         id, ip_address, username, was_successful, failure_reason
       ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      createId(),
      args.ipAddress,
      args.username,
      args.wasSuccessful ? 1 : 0,
      args.failureReason
    )
    .run();
}

export async function listSuspiciousLoginIps(
  db: D1Database,
  withinHours: number,
  minimumFailures: number,
  limit = 20
): Promise<SuspiciousLoginIpSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         ip_address,
         COUNT(*) AS failed_count,
         MAX(created_at) AS last_attempt_at,
         GROUP_CONCAT(DISTINCT NULLIF(username, '')) AS usernames
       FROM login_attempts
       WHERE was_successful = 0
         AND created_at >= datetime('now', ?)
       GROUP BY ip_address
       HAVING COUNT(*) >= ?
       ORDER BY failed_count DESC, last_attempt_at DESC
       LIMIT ?`
    )
    .bind(`-${withinHours} hours`, minimumFailures, limit)
    .all<SuspiciousLoginIpSummary>();

  return result.results ?? [];
}

export async function clearFailedLoginAttemptsByIp(db: D1Database, ipAddress: string): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM login_attempts
       WHERE ip_address = ?
         AND was_successful = 0`
    )
    .bind(ipAddress)
    .run();

  return result.meta?.changes ?? 0;
}
