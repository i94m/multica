-- Workspace roles share a name namespace within their workspace. Global roles
-- are covered by 9997 because NULL is distinct from NULL in a plain UNIQUE.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_role_workspace_name
    ON agent_role(workspace_id, name) WHERE workspace_id IS NOT NULL;
