-- Platform admin console queries. These are global (cross-workspace) reads and
-- must only be reached through the admin package's RequirePlatformAdmin
-- middleware. Keep the selected columns explicit: the admin API must never
-- return agent secrets, MCP config, runtime config, or token hashes.

-- name: IsPlatformAdmin :one
SELECT EXISTS (
    SELECT 1 FROM platform_admin WHERE user_id = $1
);

-- name: HasAnyPlatformAdmin :one
SELECT EXISTS (
    SELECT 1 FROM platform_admin
);

-- name: CreatePlatformAdmin :exec
INSERT INTO platform_admin (user_id)
VALUES ($1)
ON CONFLICT (user_id) DO NOTHING;

-- name: DeletePlatformAdmin :exec
DELETE FROM platform_admin WHERE user_id = $1;

-- name: ListAdminUsers :many
WITH params AS (
    SELECT
        sqlc.arg('query')::text AS query,
        sqlc.narg('cursor_created_at')::timestamptz AS cursor_created_at,
        sqlc.narg('cursor_id')::uuid AS cursor_id,
        sqlc.arg('page_limit')::int AS page_limit
)
SELECT
    u.id,
    u.name,
    u.email,
    u.avatar_url,
    u.created_at,
    u.onboarded_at,
    (SELECT count(*) FROM member m WHERE m.user_id = u.id)::bigint AS workspace_count
FROM "user" u
CROSS JOIN params p
WHERE (
    p.query = ''
    OR u.name ILIKE '%' || p.query || '%'
    OR u.email ILIKE '%' || p.query || '%'
)
AND (
    p.cursor_created_at IS NULL
    OR (u.created_at, u.id) < (p.cursor_created_at, p.cursor_id)
)
ORDER BY u.created_at DESC, u.id DESC
LIMIT (SELECT page_limit FROM params);

-- name: GetAdminUser :one
SELECT
    u.id,
    u.name,
    u.email,
    u.avatar_url,
    u.created_at,
    u.onboarded_at,
    (SELECT count(*) FROM member m WHERE m.user_id = u.id)::bigint AS workspace_count
FROM "user" u
WHERE u.id = $1;

-- name: ListAdminUserMemberships :many
SELECT
    m.id,
    m.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    m.role,
    m.created_at
FROM member m
JOIN workspace w ON w.id = m.workspace_id
WHERE m.user_id = $1
ORDER BY m.created_at ASC;

-- name: ListAdminWorkspaces :many
WITH params AS (
    SELECT
        sqlc.arg('query')::text AS query,
        sqlc.narg('cursor_created_at')::timestamptz AS cursor_created_at,
        sqlc.narg('cursor_id')::uuid AS cursor_id,
        sqlc.arg('page_limit')::int AS page_limit
)
SELECT
    w.id,
    w.name,
    w.slug,
    w.avatar_url,
    w.created_at,
    (SELECT count(*) FROM member m WHERE m.workspace_id = w.id)::bigint AS member_count,
    (SELECT count(*) FROM issue i WHERE i.workspace_id = w.id)::bigint AS issue_count,
    (SELECT count(*) FROM agent a WHERE a.workspace_id = w.id AND a.archived_at IS NULL)::bigint AS agent_count,
    (SELECT count(*) FROM agent_runtime r WHERE r.workspace_id = w.id)::bigint AS runtime_count
FROM workspace w
CROSS JOIN params p
WHERE (
    p.query = ''
    OR w.name ILIKE '%' || p.query || '%'
    OR w.slug ILIKE '%' || p.query || '%'
)
AND (
    p.cursor_created_at IS NULL
    OR (w.created_at, w.id) < (p.cursor_created_at, p.cursor_id)
)
ORDER BY w.created_at DESC, w.id DESC
LIMIT (SELECT page_limit FROM params);

-- name: GetAdminWorkspace :one
SELECT
    w.id,
    w.name,
    w.slug,
    w.avatar_url,
    w.created_at,
    (SELECT count(*) FROM member m WHERE m.workspace_id = w.id)::bigint AS member_count,
    (SELECT count(*) FROM issue i WHERE i.workspace_id = w.id)::bigint AS issue_count,
    (SELECT count(*) FROM agent a WHERE a.workspace_id = w.id AND a.archived_at IS NULL)::bigint AS agent_count,
    (SELECT count(*) FROM agent_runtime r WHERE r.workspace_id = w.id)::bigint AS runtime_count
FROM workspace w
WHERE w.id = $1;

-- name: ListAdminWorkspaceOwners :many
SELECT
    m.user_id,
    u.name,
    u.email,
    m.created_at
FROM member m
JOIN "user" u ON u.id = m.user_id
WHERE m.workspace_id = $1 AND m.role = 'owner'
ORDER BY m.created_at ASC;

-- name: ListAdminTasks :many
WITH params AS (
    SELECT
        sqlc.arg('status')::text AS status,
        sqlc.narg('workspace_id')::uuid AS workspace_id,
        sqlc.narg('agent_id')::uuid AS agent_id,
        sqlc.narg('runtime_id')::uuid AS runtime_id,
        sqlc.narg('from_at')::timestamptz AS from_at,
        sqlc.narg('to_at')::timestamptz AS to_at,
        sqlc.narg('cursor_created_at')::timestamptz AS cursor_created_at,
        sqlc.narg('cursor_id')::uuid AS cursor_id,
        sqlc.arg('page_limit')::int AS page_limit
)
SELECT
    t.id,
    t.agent_id,
    t.issue_id,
    t.runtime_id,
    t.status,
    t.created_at,
    t.started_at,
    t.completed_at,
    t.failure_reason,
    t.error,
    t.trigger_summary,
    t.attempt,
    t.max_attempts,
    a.name AS agent_name,
    a.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    i.number AS issue_number,
    i.title AS issue_title,
    r.name AS runtime_name,
    (SELECT coalesce(sum(tu.input_tokens), 0) FROM task_usage tu WHERE tu.task_id = t.id)::bigint AS input_tokens,
    (SELECT coalesce(sum(tu.output_tokens), 0) FROM task_usage tu WHERE tu.task_id = t.id)::bigint AS output_tokens,
    (SELECT coalesce(sum(tu.cost_usd_ticks), 0) FROM task_usage tu WHERE tu.task_id = t.id)::bigint AS cost_usd_ticks
FROM agent_task_queue t
JOIN agent a ON a.id = t.agent_id
JOIN workspace w ON w.id = a.workspace_id
LEFT JOIN issue i ON i.id = t.issue_id
LEFT JOIN agent_runtime r ON r.id = t.runtime_id
CROSS JOIN params p
WHERE (
    p.status = ''
    OR t.status = p.status
)
AND (p.workspace_id IS NULL OR a.workspace_id = p.workspace_id)
AND (p.agent_id IS NULL OR t.agent_id = p.agent_id)
AND (p.runtime_id IS NULL OR t.runtime_id = p.runtime_id)
AND (p.from_at IS NULL OR t.created_at >= p.from_at)
AND (p.to_at IS NULL OR t.created_at < p.to_at)
AND (
    p.cursor_created_at IS NULL
    OR (t.created_at, t.id) < (p.cursor_created_at, p.cursor_id)
)
ORDER BY t.created_at DESC, t.id DESC
LIMIT (SELECT page_limit FROM params);

-- name: GetAdminTask :one
SELECT
    t.id,
    t.agent_id,
    t.issue_id,
    t.runtime_id,
    t.status,
    t.created_at,
    t.started_at,
    t.completed_at,
    t.failure_reason,
    t.error,
    t.trigger_summary,
    t.attempt,
    t.max_attempts,
    t.workflow_step,
    t.branch_name,
    a.name AS agent_name,
    a.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    i.number AS issue_number,
    i.title AS issue_title,
    r.name AS runtime_name,
    (SELECT coalesce(sum(tu.input_tokens), 0) FROM task_usage tu WHERE tu.task_id = t.id)::bigint AS input_tokens,
    (SELECT coalesce(sum(tu.output_tokens), 0) FROM task_usage tu WHERE tu.task_id = t.id)::bigint AS output_tokens,
    (SELECT coalesce(sum(tu.cost_usd_ticks), 0) FROM task_usage tu WHERE tu.task_id = t.id)::bigint AS cost_usd_ticks
FROM agent_task_queue t
JOIN agent a ON a.id = t.agent_id
JOIN workspace w ON w.id = a.workspace_id
LEFT JOIN issue i ON i.id = t.issue_id
LEFT JOIN agent_runtime r ON r.id = t.runtime_id
WHERE t.id = $1;

-- name: ListAdminAgents :many
WITH params AS (
    SELECT
        sqlc.arg('query')::text AS query,
        sqlc.narg('workspace_id')::uuid AS workspace_id,
        sqlc.arg('include_archived')::boolean AS include_archived,
        sqlc.narg('cursor_created_at')::timestamptz AS cursor_created_at,
        sqlc.narg('cursor_id')::uuid AS cursor_id,
        sqlc.arg('page_limit')::int AS page_limit
)
SELECT
    a.id,
    a.name,
    a.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    a.status,
    a.kind,
    a.permission_mode,
    a.owner_id,
    u.name AS owner_name,
    u.email AS owner_email,
    a.runtime_id,
    r.name AS runtime_name,
    a.created_at,
    a.archived_at,
    (SELECT count(*) FROM agent_task_queue t WHERE t.agent_id = a.id AND t.created_at >= now() - interval '30 days')::bigint AS runs_30d
FROM agent a
JOIN workspace w ON w.id = a.workspace_id
LEFT JOIN "user" u ON u.id = a.owner_id
LEFT JOIN agent_runtime r ON r.id = a.runtime_id
CROSS JOIN params p
WHERE (
    p.query = ''
    OR a.name ILIKE '%' || p.query || '%'
)
AND (p.workspace_id IS NULL OR a.workspace_id = p.workspace_id)
AND (p.include_archived OR a.archived_at IS NULL)
AND (
    p.cursor_created_at IS NULL
    OR (a.created_at, a.id) < (p.cursor_created_at, p.cursor_id)
)
ORDER BY a.created_at DESC, a.id DESC
LIMIT (SELECT page_limit FROM params);

-- name: GetAdminAgent :one
SELECT
    a.id,
    a.name,
    a.description,
    a.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    a.status,
    a.kind,
    a.permission_mode,
    a.owner_id,
    u.name AS owner_name,
    u.email AS owner_email,
    a.runtime_id,
    r.name AS runtime_name,
    a.model,
    a.created_at,
    a.updated_at,
    a.archived_at,
    (SELECT count(*) FROM agent_task_queue t WHERE t.agent_id = a.id AND t.created_at >= now() - interval '30 days')::bigint AS runs_30d
FROM agent a
JOIN workspace w ON w.id = a.workspace_id
LEFT JOIN "user" u ON u.id = a.owner_id
LEFT JOIN agent_runtime r ON r.id = a.runtime_id
WHERE a.id = $1;

-- name: ListAdminRuntimes :many
WITH params AS (
    SELECT
        sqlc.arg('query')::text AS query,
        sqlc.narg('workspace_id')::uuid AS workspace_id,
        sqlc.arg('status')::text AS status,
        sqlc.narg('cursor_created_at')::timestamptz AS cursor_created_at,
        sqlc.narg('cursor_id')::uuid AS cursor_id,
        sqlc.arg('page_limit')::int AS page_limit
)
SELECT
    r.id,
    r.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    coalesce(r.custom_name, r.name) AS display_name,
    r.provider,
    r.status,
    r.last_seen_at,
    r.created_at,
    r.owner_id,
    u.name AS owner_name,
    u.email AS owner_email,
    r.visibility,
    r.device_info
FROM agent_runtime r
JOIN workspace w ON w.id = r.workspace_id
LEFT JOIN "user" u ON u.id = r.owner_id
CROSS JOIN params p
WHERE (
    p.query = ''
    OR coalesce(r.custom_name, r.name) ILIKE '%' || p.query || '%'
    OR r.provider ILIKE '%' || p.query || '%'
)
AND (p.workspace_id IS NULL OR r.workspace_id = p.workspace_id)
AND (p.status = '' OR r.status = p.status)
AND (
    p.cursor_created_at IS NULL
    OR (r.created_at, r.id) < (p.cursor_created_at, p.cursor_id)
)
ORDER BY r.created_at DESC, r.id DESC
LIMIT (SELECT page_limit FROM params);

-- name: GetAdminRuntime :one
SELECT
    r.id,
    r.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    coalesce(r.custom_name, r.name) AS display_name,
    r.provider,
    r.status,
    r.last_seen_at,
    r.created_at,
    r.owner_id,
    u.name AS owner_name,
    u.email AS owner_email,
    r.visibility,
    r.device_info,
    (SELECT count(*) FROM agent_task_queue t WHERE t.runtime_id = r.id)::bigint AS task_count,
    (SELECT count(*) FROM agent_task_queue t WHERE t.runtime_id = r.id AND t.status IN ('queued', 'dispatched', 'running', 'waiting_local_directory'))::bigint AS active_task_count
FROM agent_runtime r
JOIN workspace w ON w.id = r.workspace_id
LEFT JOIN "user" u ON u.id = r.owner_id
WHERE r.id = $1;

-- name: AdminOverviewCounts :one
SELECT
    (SELECT count(*) FROM "user")::bigint AS users,
    (SELECT count(*) FROM workspace)::bigint AS workspaces,
    (SELECT count(*) FROM member)::bigint AS members,
    (SELECT count(*) FROM issue)::bigint AS issues,
    (SELECT count(*) FROM agent WHERE archived_at IS NULL)::bigint AS agents,
    (SELECT count(*) FROM agent_runtime WHERE status = 'online')::bigint AS runtimes_online,
    (SELECT count(*) FROM agent_runtime WHERE status <> 'online')::bigint AS runtimes_offline,
    (SELECT count(*) FROM agent_task_queue WHERE status IN ('queued', 'dispatched', 'running', 'waiting_local_directory'))::bigint AS tasks_active,
    (SELECT count(*) FROM agent_task_queue WHERE status = 'failed' AND created_at > now() - interval '24 hours')::bigint AS tasks_failed_24h,
    (SELECT count(*) FROM agent_task_queue WHERE created_at > now() - interval '24 hours')::bigint AS tasks_24h;

-- name: AdminTasksByStatus :many
SELECT status, count(*)::bigint AS count
FROM agent_task_queue
GROUP BY status
ORDER BY count DESC;

-- name: AdminSignupsDaily :many
SELECT
    date_trunc('day', created_at)::date AS day,
    count(*)::bigint AS count
FROM "user"
WHERE created_at >= $1
GROUP BY 1
ORDER BY 1;

-- name: AdminTasksDaily :many
SELECT
    date_trunc('day', created_at)::date AS day,
    count(*) FILTER (WHERE status = 'completed')::bigint AS completed,
    count(*) FILTER (WHERE status = 'failed')::bigint AS failed
FROM agent_task_queue
WHERE created_at >= $1
GROUP BY 1
ORDER BY 1;

-- name: AdminUsageTotals :one
SELECT
    coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
    coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
    coalesce(sum(cache_read_tokens), 0)::bigint AS cache_read_tokens,
    coalesce(sum(cache_write_tokens), 0)::bigint AS cache_write_tokens,
    coalesce(sum(cost_usd_ticks), 0)::bigint AS cost_usd_ticks,
    coalesce(sum(task_count), 0)::bigint AS task_count
FROM task_usage_hourly
WHERE bucket_hour >= $1 AND bucket_hour < $2;

-- name: ListAdminUsageByWorkspace :many
SELECT
    h.workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    coalesce(sum(h.input_tokens), 0)::bigint AS input_tokens,
    coalesce(sum(h.output_tokens), 0)::bigint AS output_tokens,
    coalesce(sum(h.cost_usd_ticks), 0)::bigint AS cost_usd_ticks
FROM task_usage_hourly h
JOIN workspace w ON w.id = h.workspace_id
WHERE h.bucket_hour >= $1 AND h.bucket_hour < $2
GROUP BY h.workspace_id, w.name, w.slug
ORDER BY cost_usd_ticks DESC
LIMIT $3;

-- name: ListAdminUsageByAgent :many
SELECT
    h.agent_id,
    coalesce(a.name, '') AS agent_name,
    h.workspace_id,
    w.name AS workspace_name,
    coalesce(sum(h.input_tokens), 0)::bigint AS input_tokens,
    coalesce(sum(h.output_tokens), 0)::bigint AS output_tokens,
    coalesce(sum(h.cost_usd_ticks), 0)::bigint AS cost_usd_ticks
FROM task_usage_hourly h
JOIN workspace w ON w.id = h.workspace_id
LEFT JOIN agent a ON a.id = h.agent_id
WHERE h.bucket_hour >= $1 AND h.bucket_hour < $2
GROUP BY h.agent_id, a.name, h.workspace_id, w.name
ORDER BY cost_usd_ticks DESC
LIMIT $3;

-- name: ListAdminUsageByModel :many
SELECT
    h.provider,
    h.model,
    coalesce(sum(h.input_tokens), 0)::bigint AS input_tokens,
    coalesce(sum(h.output_tokens), 0)::bigint AS output_tokens,
    coalesce(sum(h.cost_usd_ticks), 0)::bigint AS cost_usd_ticks,
    coalesce(sum(h.task_count), 0)::bigint AS task_count
FROM task_usage_hourly h
WHERE h.bucket_hour >= $1 AND h.bucket_hour < $2
GROUP BY h.provider, h.model
ORDER BY cost_usd_ticks DESC
LIMIT $3;
