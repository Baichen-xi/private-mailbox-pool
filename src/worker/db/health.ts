export interface DatabaseHealth {
  legacySubdomainUniqueIndexExists: boolean;
  requiredTablesExist: boolean;
  subdomainVerificationStatusColumnExists: boolean;
  mailboxGroupIdColumnExists: boolean;
  mailboxGroupsTableExists: boolean;
  subdomainVerificationStatusIndexExists: boolean;
  mailboxGroupIdIndexExists: boolean;
  migrations: Array<{
    id: "0001" | "0003" | "0004";
    status: "ok" | "missing" | "warning";
  }>;
  schemaReady: boolean;
}

export async function getDatabaseHealth(db: D1Database): Promise<DatabaseHealth> {
  type KnownTableName = "subdomains" | "mailboxes";

  async function objectExists(type: "table" | "index", name: string): Promise<boolean> {
    const row = await db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = ?
           AND name = ?
         LIMIT 1`
      )
      .bind(type, name)
      .first<{ name: string }>();

    return Boolean(row);
  }

  async function columnExists(tableName: KnownTableName, columnName: string): Promise<boolean> {
    const row = await db
      .prepare(
        `SELECT name
         FROM pragma_table_info('${tableName}')
         WHERE name = ?
         LIMIT 1`
      )
      .bind(columnName)
      .first<{ name: string }>();

    return Boolean(row);
  }

  const [
    adminsTableExists,
    sessionsTableExists,
    subdomainsTableExists,
    mailboxesTableExists,
    mailboxTokensTableExists,
    emailsTableExists,
    attachmentsTableExists,
    loginAttemptsTableExists,
    rateLimitBucketsTableExists,
    settingsTableExists,
    auditLogsTableExists,
    legacyIndexExists,
    verificationStatusColumnExists,
    groupIdColumnExists,
    mailboxGroupsTableExists,
    verificationStatusIndexExists,
    groupIdIndexExists
  ] = await Promise.all([
    objectExists("table", "admins"),
    objectExists("table", "sessions"),
    objectExists("table", "subdomains"),
    objectExists("table", "mailboxes"),
    objectExists("table", "mailbox_tokens"),
    objectExists("table", "emails"),
    objectExists("table", "attachments"),
    objectExists("table", "login_attempts"),
    objectExists("table", "rate_limit_buckets"),
    objectExists("table", "settings"),
    objectExists("table", "audit_logs"),
    objectExists("index", "idx_mailboxes_unique_subdomain"),
    columnExists("subdomains", "verification_status"),
    columnExists("mailboxes", "group_id"),
    objectExists("table", "mailbox_groups"),
    objectExists("index", "idx_subdomains_verification_status"),
    objectExists("index", "idx_mailboxes_group_id")
  ]);

  const requiredTablesExist =
    adminsTableExists &&
    sessionsTableExists &&
    subdomainsTableExists &&
    mailboxesTableExists &&
    mailboxTokensTableExists &&
    emailsTableExists &&
    attachmentsTableExists &&
    loginAttemptsTableExists &&
    rateLimitBucketsTableExists &&
    settingsTableExists &&
    auditLogsTableExists;
  const migration0003Ready = !legacyIndexExists;
  const migration0004Ready = verificationStatusColumnExists && groupIdColumnExists && mailboxGroupsTableExists;
  const schemaReady = requiredTablesExist && migration0003Ready && migration0004Ready;

  return {
    legacySubdomainUniqueIndexExists: legacyIndexExists,
    requiredTablesExist,
    subdomainVerificationStatusColumnExists: verificationStatusColumnExists,
    mailboxGroupIdColumnExists: groupIdColumnExists,
    mailboxGroupsTableExists,
    subdomainVerificationStatusIndexExists: verificationStatusIndexExists,
    mailboxGroupIdIndexExists: groupIdIndexExists,
    migrations: [
      {
        id: "0001",
        status: requiredTablesExist ? "ok" : "missing"
      },
      {
        id: "0003",
        status: migration0003Ready ? "ok" : "missing"
      },
      {
        id: "0004",
        status: migration0004Ready
          ? verificationStatusIndexExists && groupIdIndexExists
            ? "ok"
            : "warning"
          : "missing"
      }
    ],
    schemaReady
  };
}
