-- Reusable agent roles. A NULL workspace_id marks a global role.

-- name: ListAgentRoles :many
-- One workspace's roles plus every global role. `is_default` is computed
-- against the workspace being viewed, so the same global role can be default
-- in one workspace and not another.
SELECT
    r.*,
    (r.id = w.default_agent_role_id) AS is_default,
    (SELECT count(*) FROM agent a WHERE a.role_id = r.id) AS agent_count
FROM agent_role r
JOIN workspace w ON w.id = @workspace_id
WHERE r.workspace_id = @workspace_id OR r.workspace_id IS NULL
ORDER BY (r.workspace_id IS NULL), lower(r.name);

-- name: GetAgentRole :one
SELECT * FROM agent_role WHERE id = $1;

-- name: GetAgentRoleVisibleInWorkspace :one
SELECT * FROM agent_role
WHERE id = $1 AND (workspace_id = $2 OR workspace_id IS NULL);

-- name: GetWorkspaceDefaultAgentRole :one
SELECT r.*
FROM agent_role r
JOIN workspace w ON w.default_agent_role_id = r.id
WHERE w.id = $1;

-- name: GetWorkspaceDefaultAgentRoleID :one
SELECT default_agent_role_id FROM workspace WHERE id = $1;

-- name: CreateAgentRole :one
INSERT INTO agent_role (
    workspace_id, name, description, instructions, created_by
) VALUES (
    sqlc.narg('workspace_id'), @name, @description, @instructions, @created_by
)
RETURNING *;

-- name: UpdateAgentRole :one
UPDATE agent_role SET
    name = @name,
    description = @description,
    instructions = @instructions,
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: DeleteAgentRole :exec
DELETE FROM agent_role WHERE id = $1;

-- name: ClearAgentRoleReferences :exec
-- No FK by design: deleting a role detaches agents instead of blocking.
UPDATE agent SET role_id = NULL, updated_at = now() WHERE role_id = $1;

-- name: ClearWorkspaceDefaultAgentRoleReferences :exec
UPDATE workspace SET default_agent_role_id = NULL, updated_at = now()
WHERE default_agent_role_id = $1;

-- name: SetWorkspaceDefaultAgentRole :exec
UPDATE workspace SET default_agent_role_id = @role_id, updated_at = now()
WHERE id = @workspace_id;

-- name: ClearWorkspaceDefaultAgentRole :exec
UPDATE workspace SET default_agent_role_id = NULL, updated_at = now()
WHERE id = $1;

-- name: CountAgentsUsingRole :one
SELECT count(*) FROM agent WHERE role_id = $1;
