import { createId } from "../lib/ids";

export interface SessionRecord {
  id: string;
  admin_id: string;
  session_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function createSessionRecord(
  db: D1Database,
  args: {
    adminId: string;
    tokenHash: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (
         id, admin_id, session_token_hash, ip_address, user_agent, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId(),
      args.adminId,
      args.tokenHash,
      args.ipAddress,
      args.userAgent,
      args.expiresAt
    )
    .run();
}

export async function getSessionByTokenHash(
  db: D1Database,
  tokenHash: string
): Promise<(SessionRecord & { username: string }) | null> {
  return db
    .prepare(
      `SELECT
         sessions.id,
         sessions.admin_id,
         sessions.session_token_hash,
         sessions.expires_at,
         sessions.revoked_at,
         admins.username
       FROM sessions
       INNER JOIN admins ON admins.id = sessions.admin_id
       WHERE sessions.session_token_hash = ?
         AND sessions.revoked_at IS NULL
         AND sessions.expires_at > CURRENT_TIMESTAMP
         AND admins.is_active = 1
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<SessionRecord & { username: string }>();
}

export async function revokeSessionByTokenHash(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `UPDATE sessions
       SET revoked_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_token_hash = ?
         AND revoked_at IS NULL`
    )
    .bind(tokenHash)
    .run();
}
