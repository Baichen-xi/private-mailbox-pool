CREATE UNIQUE INDEX IF NOT EXISTS idx_mailboxes_unique_subdomain
  ON mailboxes(subdomain_id);
