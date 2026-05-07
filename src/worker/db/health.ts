export interface DatabaseHealth {
  legacySubdomainUniqueIndexExists: boolean;
}

export async function getDatabaseHealth(db: D1Database): Promise<DatabaseHealth> {
  const legacyIndex = await db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'index'
         AND name = 'idx_mailboxes_unique_subdomain'
       LIMIT 1`
    )
    .first<{ name: string }>();

  return {
    legacySubdomainUniqueIndexExists: Boolean(legacyIndex)
  };
}
