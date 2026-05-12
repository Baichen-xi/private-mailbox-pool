CREATE TABLE IF NOT EXISTS mail_block_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (
    rule_type IN ('sender_email', 'sender_domain', 'subject_keyword', 'attachment_type')
  ),
  value TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'reject' CHECK (
    action IN ('reject')
  ),
  note TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_block_rules_type_value
  ON mail_block_rules(rule_type, value);

CREATE INDEX IF NOT EXISTS idx_mail_block_rules_active
  ON mail_block_rules(is_active, rule_type);
