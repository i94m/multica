-- Global task list in the admin console orders by creation time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_task_created
    ON agent_task_queue (created_at DESC, id DESC);
