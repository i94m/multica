-- Reusable agent roles. A NULL workspace_id marks a global role.

-- name: ListAgentRoles :many
-- One workspace's roles plus every global role.
SELECT
    r.*,
    (SELECT count(*) FROM agent a WHERE a.role_id = r.id) AS agent_count
FROM agent_role r
WHERE r.workspace_id = @workspace_id OR r.workspace_id IS NULL
ORDER BY (r.workspace_id IS NULL), lower(r.name);

-- name: GetAgentRole :one
SELECT * FROM agent_role WHERE id = $1;

-- name: GetAgentRoleVisibleInWorkspace :one
SELECT * FROM agent_role
WHERE id = $1 AND (workspace_id = $2 OR workspace_id IS NULL);

-- name: CreateAgentRole :one
INSERT INTO agent_role (
    workspace_id, name, description, instructions, created_by
) VALUES (
    sqlc.narg('workspace_id'), @name, @description, @instructions, @created_by
)
RETURNING *;

-- name: UpdateAgentRole :one
-- workspace_id is set explicitly so the same statement can promote a workspace
-- role to global (NULL) or claim a global role into one workspace.
UPDATE agent_role SET
    name = @name,
    description = @description,
    instructions = @instructions,
    workspace_id = sqlc.narg('workspace_id'),
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: DeleteAgentRole :exec
DELETE FROM agent_role WHERE id = $1;

-- name: ClearAgentRoleReferences :exec
-- No FK by design: deleting a role detaches agents instead of blocking.
UPDATE agent SET role_id = NULL, updated_at = now() WHERE role_id = $1;

-- name: CountAgentsUsingRole :one
SELECT count(*) FROM agent WHERE role_id = $1;

-- name: ClearAgentRoleReferencesOutsideWorkspace :exec
-- Used when a global role becomes workspace-owned: agents elsewhere must not
-- keep a binding they can no longer resolve.
UPDATE agent SET role_id = NULL, updated_at = now()
WHERE role_id = @role_id AND workspace_id <> @workspace_id;
