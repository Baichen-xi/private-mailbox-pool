DROP INDEX IF EXISTS idx_mailboxes_unique_subdomain;

UPDATE subdomains
SET status = 'available',
    assigned_mailbox_id = NULL,
    assigned_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'assigned';
