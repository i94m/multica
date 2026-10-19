-- Global roles share one namespace across every workspace.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_role_global_name
    ON agent_role(name) WHERE workspace_id IS NULL;
