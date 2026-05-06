export interface DashboardStats {
  mailboxCount: number;
  activeMailboxCount: number;
  unreadEmailCount: number;
  availableSubdomainCount: number;
}

export interface FailedLoginAlert {
  ipAddress: string;
  total: number;
}

export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const [mailboxRow, unreadRow, subdomainRow] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS mailboxCount,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeMailboxCount
         FROM mailboxes
         WHERE deleted_at IS NULL`
      )
      .first<{ mailboxCount: number | string; activeMailboxCount: number | string | null }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(unread_email_count), 0) AS unreadEmailCount
         FROM mailboxes
         WHERE deleted_at IS NULL`
      )
      .first<{ unreadEmailCount: number | string | null }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS availableSubdomainCount
         FROM subdomains
         WHERE status = 'available'`
      )
      .first<{ availableSubdomainCount: number | string }>()
  ]);

  return {
    mailboxCount: Number(mailboxRow?.mailboxCount ?? 0),
    activeMailboxCount: Number(mailboxRow?.activeMailboxCount ?? 0),
    unreadEmailCount: Number(unreadRow?.unreadEmailCount ?? 0),
    availableSubdomainCount: Number(subdomainRow?.availableSubdomainCount ?? 0)
  };
}

export async function getRecentFailedLoginAlert(db: D1Database): Promise<FailedLoginAlert | null> {
  const row = await db
    .prepare(
      `SELECT ip_address AS ipAddress, COUNT(*) AS total
       FROM login_attempts
       WHERE was_successful = 0
         AND created_at >= datetime('now', '-1 hour')
       GROUP BY ip_address
       ORDER BY total DESC
       LIMIT 1`
    )
    .first<{ ipAddress: string; total: number | string }>();

  if (!row || Number(row.total) < 3) {
    return null;
  }

  return {
    ipAddress: row.ipAddress,
    total: Number(row.total)
  };
}
