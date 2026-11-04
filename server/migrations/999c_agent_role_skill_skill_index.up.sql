-- Reverse lookup: "which roles use this skill", and the delete path when a
-- skill is removed. Its own single-statement file because the runner builds
-- concurrent indexes outside an explicit transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_role_skill_skill
    ON agent_role_skill(skill_id);
