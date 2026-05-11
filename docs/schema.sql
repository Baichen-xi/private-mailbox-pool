PRAGMA foreign_keys = ON;

-- Single-admin model for a private mailbox pool.
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'argon2id',
  access_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT,
  last_login_ip TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- A pool of pre-generated subdomains to reduce manual setup friction.
CREATE TABLE IF NOT EXISTS subdomains (
  id TEXT PRIMARY KEY,
  subdomain_label TEXT NOT NULL UNIQUE,
  full_domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'assigned', 'reserved', 'disabled')
  ),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('verified', 'unverified', 'invalid')
  ),
  assigned_mailbox_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subdomains_status ON subdomains(status);
CREATE INDEX IF NOT EXISTS idx_subdomains_verification_status ON subdomains(verification_status);

CREATE TABLE IF NOT EXISTS mailbox_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#156f5b',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id TEXT PRIMARY KEY,
  local_part TEXT NOT NULL,
  subdomain_id TEXT NOT NULL,
  group_id TEXT,
  full_address TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'archived', 'deleted')
  ),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (
    visibility IN ('private')
  ),
  note TEXT,
  retention_mode TEXT NOT NULL DEFAULT 'keep_forever' CHECK (
    retention_mode IN ('keep_forever', 'delete_after_days')
  ),
  retention_days INTEGER,
  last_received_at TEXT,
  total_email_count INTEGER NOT NULL DEFAULT 0,
  unread_email_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (subdomain_id) REFERENCES subdomains(id),
  FOREIGN KEY (group_id) REFERENCES mailbox_groups(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mailboxes_local_part_subdomain
  ON mailboxes(local_part, subdomain_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_status ON mailboxes(status);
CREATE INDEX IF NOT EXISTS idx_mailboxes_last_received_at ON mailboxes(last_received_at);
CREATE INDEX IF NOT EXISTS idx_mailboxes_group_id ON mailboxes(group_id);

CREATE TABLE IF NOT EXISTS mailbox_tokens (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'read' CHECK (
    scope IN ('read', 'read_write')
  ),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mailbox_tokens_mailbox_id ON mailbox_tokens(mailbox_id);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL,
  message_id TEXT,
  thread_key TEXT,
  from_name TEXT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  reply_to TEXT,
  subject TEXT,
  received_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  is_flagged INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
  has_attachments INTEGER NOT NULL DEFAULT 0 CHECK (has_attachments IN (0, 1)),
  html_sanitized INTEGER NOT NULL DEFAULT 0 CHECK (html_sanitized IN (0, 1)),
  size_bytes INTEGER NOT NULL DEFAULT 0,
  text_preview TEXT,
  text_body_r2_key TEXT,
  html_body_r2_key TEXT,
  raw_r2_key TEXT NOT NULL,
  headers_json TEXT,
  spam_score REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emails_mailbox_received
  ON emails(mailbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_deleted_at ON emails(deleted_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_disposition TEXT,
  cid TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  username TEXT,
  was_successful INTEGER NOT NULL CHECK (was_successful IN (0, 1)),
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
  ON login_attempts(ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id TEXT PRIMARY KEY,
  bucket_key TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_action ON rate_limit_buckets(action);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_blocked_until ON rate_limit_buckets(blocked_until);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (
    actor_type IN ('admin', 'system', 'mailbox_token', 'access')
  ),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON audit_logs(target_type, target_id, created_at DESC);

-- Seed settings expected by the MVP UI.
INSERT OR IGNORE INTO settings(key, value_json)
VALUES
  ('app', '{"appName":"Private Mailbox Pool","defaultTimezone":"Asia/Shanghai"}'),
  ('security', '{"maxLoginFailures":10,"loginBlockMinutes":15,"sessionTtlHours":24,"allowIpWhitelist":false}'),
  ('mail', '{"allowCustomLocalPart":true,"defaultRetentionMode":"keep_forever","defaultRetentionDays":null,"maxAttachmentSizeMb":10}'),
  ('subdomain_pool', '{"minAvailable":20,"generateBatchSize":50}');
