ALTER TABLE workspace DROP COLUMN IF EXISTS default_agent_role_id;
ALTER TABLE agent DROP COLUMN IF EXISTS role_id;
DROP TABLE IF EXISTS agent_role;
