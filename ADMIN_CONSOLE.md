# Platform admin console

Fork-local, read-only console for looking across every workspace: users,
workspaces, agent tasks, agents, runtimes, and usage.

The surface is intentionally isolated from the upstream product:

- Backend: `server/internal/admin/` (one registration call in
  `server/cmd/server/router.go`).
- Frontend: `apps/web/features/admin/` and `apps/web/app/admin/`.
- Database: migrations `9001`–`9004` (fork-reserved number range).

Nothing in `packages/core`, `packages/views`, `packages/ui`, the dashboard
layout, or the desktop/mobile clients is modified.

## Access

The database table `platform_admin` is authoritative:

```sql
INSERT INTO platform_admin (user_id)
SELECT id FROM "user" WHERE lower(email) = lower('ops@example.com')
ON CONFLICT (user_id) DO NOTHING;
```

Revoke with:

```sql
DELETE FROM platform_admin
WHERE user_id = (SELECT id FROM "user" WHERE lower(email) = lower('ops@example.com'));
```

`PLATFORM_ADMIN_EMAILS` is an optional bootstrap allowlist. Entries are
inserted into `platform_admin` on first access. When the variable is unset,
this fork falls back to the two deployment administrators:

```
wadewang@rayootech.com,dannyzhang@rayootech.com
```

The fallback lives in `server/internal/admin/config.go`. To use a different
list without a code change, add the variable to the backend environment. The
checked-in compose file is intentionally untouched to keep upstream merges
small; set the variable in your own deployment override if needed.

When neither the table nor the allowlist contains anyone, `/api/admin/*`
returns 404 and the console is invisible.

## URLs

- Console: `/admin`
- API: `/api/admin/*` (`me`, `overview`, `users`, `workspaces`, `tasks`,
  `agents`, `runtimes`, `usage`)

All endpoints are GET-only. Mutating platform-admin actions (delete workspace,
cancel task, disable user) are deliberately out of scope for this version.

List endpoints use the traditional page contract:

```
?page=1&page_size=25&sort=created_at&order=desc&q=...
```

`page_size` is capped at 100. `sort` and `order` are validated per endpoint
against a whitelist; unknown values fall back to the endpoint default. Search
(`q`) and the entity filters (workspace, status, provider, kind, permission,
date range) are applied on the server, so counts and pagination reflect the
filtered result set.

## Security notes

- `middleware.Auth` + `handler.RequireHumanActor` run before the admin gate, so
  agent task tokens and Cloud PATs cannot read cross-workspace data.
- Responses never include `agent.custom_env`, `agent.mcp_config`,
  `workspace_mcp_server.config`, runtime config, or any token hash.
- Every admin request is written to the server log with the user id and path.
- The console is web-only. Use a browser; desktop and mobile are unchanged.

## Merging upstream

- `server/cmd/server/router.go`: keep the single `admin.RegisterRoutes(...)`
  line at the end of `NewRouterWithOptions`.
- `server/pkg/db/generated/models.go`: on conflict, take upstream and run
  `make sqlc`; the `PlatformAdmin` struct is regenerated.
- Migrations live in the `9001+` range so a future upstream `593+` migration
  cannot share a number.
