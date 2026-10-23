-- The workspace default role was removed; roles are only selected explicitly.
ALTER TABLE workspace DROP COLUMN IF EXISTS default_agent_role_id;
