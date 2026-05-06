import { createId } from "../lib/ids";

export interface AdminRecord {
  id: string;
  username: string;
  password_hash: string;
  password_algo: string;
  is_active: number;
}

export async function getAdminByUsername(db: D1Database, username: string): Promise<AdminRecord | null> {
  return db
    .prepare(
      `SELECT id, username, password_hash, password_algo, is_active
       FROM admins
       WHERE username = ?
       LIMIT 1`
    )
    .bind(username)
    .first<AdminRecord>();
}

export async function ensureBootstrapAdmin(
  db: D1Database,
  username: string,
  passwordHash: string
): Promise<void> {
  if (!username || !passwordHash) {
    return;
  }

  const existing = await getAdminByUsername(db, username);
  if (existing) {
    return;
  }

  await db
    .prepare(
      `INSERT INTO admins (id, username, password_hash, password_algo, is_active)
       VALUES (?, ?, ?, 'pbkdf2_sha256', 1)`
    )
    .bind(createId(), username, passwordHash)
    .run();
}

export async function markAdminLogin(
  db: D1Database,
  adminId: string,
  ipAddress: string | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE admins
       SET last_login_at = CURRENT_TIMESTAMP,
           last_login_ip = ?
       WHERE id = ?`
    )
    .bind(ipAddress, adminId)
    .run();
}
