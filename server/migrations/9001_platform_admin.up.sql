-- Platform administrators for the fork-local admin console.
--
-- No foreign keys by repository rule: user_id / granted_by are validated in
-- the application layer. The table is the authoritative grant list; the
-- optional PLATFORM_ADMIN_EMAILS env var is only a bootstrap convenience.
CREATE TABLE platform_admin (
    user_id    uuid PRIMARY KEY,
    granted_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);
