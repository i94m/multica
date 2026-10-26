-- Global runtime list in the admin console orders by creation time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_runtime_created
    ON agent_runtime (created_at DESC, id DESC);
