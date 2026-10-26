-- Global workspace list in the admin console orders by creation time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_workspace_created
    ON workspace (created_at DESC, id DESC);
