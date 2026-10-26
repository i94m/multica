-- Global agent list in the admin console orders by creation time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_agent_created
    ON agent (created_at DESC, id DESC);
