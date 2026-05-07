export interface AdminPanelStats {
  adminCount: number;
  activeAdminCount: number;
  activeSessionCount: number;
  failedLoginCount24h: number;
  auditEventCount24h: number;
}

export interface AdminSummary {
  id: string;
  username: string;
  is_active: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
}

export interface AdminSessionSummary {
  id: string;
  admin_id: string;
  session_token_hash: string;
  username: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface LoginAttemptSummary {
  ip_address: string;
  username: string | null;
  was_successful: number;
  failure_reason: string | null;
  created_at: string;
}

export interface AuditLogSummary {
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
}

export async function getAdminPanelStats(db: D1Database): Promise<AdminPanelStats> {
  const [adminRow, sessionRow, failedRow, auditRow] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS adminCount,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeAdminCount
         FROM admins`
      )
      .first<{ adminCount: number | string; activeAdminCount: number | string | null }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS activeSessionCount
         FROM sessions
         WHERE revoked_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP`
      )
      .first<{ activeSessionCount: number | string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS failedLoginCount24h
         FROM login_attempts
         WHERE was_successful = 0
           AND created_at >= datetime('now', '-24 hours')`
      )
      .first<{ failedLoginCount24h: number | string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS auditEventCount24h
         FROM audit_logs
         WHERE created_at >= datetime('now', '-24 hours')`
      )
      .first<{ auditEventCount24h: number | string }>()
  ]);

  return {
    adminCount: Number(adminRow?.adminCount ?? 0),
    activeAdminCount: Number(adminRow?.activeAdminCount ?? 0),
    activeSessionCount: Number(sessionRow?.activeSessionCount ?? 0),
    failedLoginCount24h: Number(failedRow?.failedLoginCount24h ?? 0),
    auditEventCount24h: Number(auditRow?.auditEventCount24h ?? 0)
  };
}

export async function listAdminSummaries(db: D1Database, limit = 10): Promise<AdminSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         id,
         username,
         is_active,
         last_login_at,
         last_login_ip,
         created_at
       FROM admins
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<AdminSummary>();

  return result.results ?? [];
}

export async function listRecentSessions(db: D1Database, limit = 8): Promise<AdminSessionSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         sessions.id,
         sessions.admin_id,
         sessions.session_token_hash,
         admins.username,
         sessions.ip_address,
         sessions.created_at,
         sessions.expires_at,
         sessions.revoked_at
       FROM sessions
       INNER JOIN admins ON admins.id = sessions.admin_id
       ORDER BY sessions.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<AdminSessionSummary>();

  return result.results ?? [];
}

export async function listRecentLoginAttempts(
  db: D1Database,
  limit = 10
): Promise<LoginAttemptSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         ip_address,
         username,
         was_successful,
         failure_reason,
         created_at
       FROM login_attempts
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<LoginAttemptSummary>();

  return result.results ?? [];
}

export async function listRecentAuditLogs(db: D1Database, limit = 10): Promise<AuditLogSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         action,
         target_type,
         target_id,
         created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<AuditLogSummary>();

  return result.results ?? [];
}
