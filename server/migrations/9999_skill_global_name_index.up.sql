-- Global skills share one namespace. The existing UNIQUE(workspace_id, name)
-- cannot enforce it because NULL is distinct from NULL.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_skill_global_name
    ON skill(name) WHERE workspace_id IS NULL;
