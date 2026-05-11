ALTER TABLE subdomains ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_subdomains_verification_status
  ON subdomains(verification_status);

CREATE TABLE IF NOT EXISTS mailbox_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#156f5b',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE mailboxes ADD COLUMN group_id TEXT;

CREATE INDEX IF NOT EXISTS idx_mailboxes_group_id
  ON mailboxes(group_id);
