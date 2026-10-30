-- name: ListProjectResources :many
SELECT * FROM project_resource
WHERE project_id = $1
ORDER BY position ASC, created_at ASC;

-- name: ListProjectResourcesVisibleToUser :many
-- Project-page read. A local_directory pins one absolute path on one person's
-- machine, so it is shown only to the member who attached it and to the owner
-- of the daemon it names; repo resources stay shared workspace config and are
-- visible to every member. The daemon claim path deliberately does NOT use this
-- query: a claim is answered for the daemon that will run the task, and
-- filtering by the requesting user there would drop the caller's own path.
--
-- A row that cannot be attributed to anyone — no creator recorded and no
-- runtime ever registered an owner for its daemon_id — stays visible to every
-- member. Those are legacy rows and shared-machine daemons registered without
-- user credentials; hiding them would strand data nobody could then see or
-- delete, while attributing them to a member would be a guess.
SELECT pr.* FROM project_resource pr
WHERE pr.project_id = sqlc.arg('project_id')
  AND (
    pr.resource_type <> 'local_directory'
    OR pr.created_by = sqlc.arg('viewer_id')
    OR EXISTS (
      SELECT 1 FROM agent_runtime ar
      WHERE ar.workspace_id = pr.workspace_id
        AND ar.daemon_id = pr.resource_ref->>'daemon_id'
        AND ar.owner_id = sqlc.arg('viewer_id')
    )
    OR (
      pr.created_by IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM agent_runtime ar
        WHERE ar.workspace_id = pr.workspace_id
          AND ar.daemon_id = pr.resource_ref->>'daemon_id'
          AND ar.owner_id IS NOT NULL
      )
    )
  )
ORDER BY pr.position ASC, pr.created_at ASC;

-- name: GetProjectResourceVisibleToUser :one
-- Same visibility rule as ListProjectResourcesVisibleToUser, for the
-- write-by-id paths: not being able to see a local_directory must also mean not
-- being able to edit or delete it by guessing its id. Keep the two predicates
-- in sync.
SELECT pr.* FROM project_resource pr
WHERE pr.id = sqlc.arg('id')
  AND pr.workspace_id = sqlc.arg('workspace_id')
  AND (
    pr.resource_type <> 'local_directory'
    OR pr.created_by = sqlc.arg('viewer_id')
    OR EXISTS (
      SELECT 1 FROM agent_runtime ar
      WHERE ar.workspace_id = pr.workspace_id
        AND ar.daemon_id = pr.resource_ref->>'daemon_id'
        AND ar.owner_id = sqlc.arg('viewer_id')
    )
    OR (
      pr.created_by IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM agent_runtime ar
        WHERE ar.workspace_id = pr.workspace_id
          AND ar.daemon_id = pr.resource_ref->>'daemon_id'
          AND ar.owner_id IS NOT NULL
      )
    )
  );

-- name: ListProjectResourcesInWorkspace :many
-- Workspace-scoped read for the daemon claim path. project_resource carries its
-- own workspace_id, so a corrupt project reference cannot pull another tenant's
-- repository URLs or local paths into a claim response.
SELECT * FROM project_resource
WHERE project_id = $1 AND workspace_id = $2
ORDER BY position ASC, created_at ASC;

-- name: ListProjectResourcesForProjects :many
SELECT * FROM project_resource
WHERE project_id = ANY(sqlc.arg('project_ids')::uuid[])
ORDER BY project_id, position ASC, created_at ASC;

-- name: GetProjectResource :one
SELECT * FROM project_resource
WHERE id = $1;

-- name: GetProjectResourceInWorkspace :one
SELECT * FROM project_resource
WHERE id = $1 AND workspace_id = $2;

-- name: GetProjectResourceInWorkspaceForUpdate :one
-- Same row as GetProjectResourceInWorkspace, but takes a row lock held until
-- the caller's transaction ends, serializing the read-decide-write flow in
-- UpdateProjectResource against competing partial updates (#9238).
SELECT * FROM project_resource
WHERE id = $1 AND workspace_id = $2
FOR UPDATE;

-- name: CreateProjectResource :one
INSERT INTO project_resource (
    project_id, workspace_id, resource_type, resource_ref, label, position, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: UpdateProjectResource :one
UPDATE project_resource
SET resource_ref = $2,
    label        = $3,
    position     = $4
WHERE id = $1
RETURNING *;

-- name: DeleteProjectResource :exec
DELETE FROM project_resource WHERE id = $1;

-- name: CountProjectResources :one
SELECT count(*) FROM project_resource WHERE project_id = $1;

-- name: GetProjectResourceCounts :many
SELECT project_id, count(*)::bigint AS resource_count
FROM project_resource
WHERE project_id = ANY(sqlc.arg('project_ids')::uuid[])
GROUP BY project_id;
