-- Roles are now platform-level: managed from the admin console and maintained
-- by platform admins only. Every existing workspace role becomes global, so
-- its visibility expands to every workspace — that is the intended new model,
-- not a side effect: a role is a job definition shared across the instance.
UPDATE agent_role SET workspace_id = NULL WHERE workspace_id IS NOT NULL;
