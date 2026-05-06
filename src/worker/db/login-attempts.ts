import { createId } from "../lib/ids";
import { minutesAgoTimestamp } from "../lib/time";

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
