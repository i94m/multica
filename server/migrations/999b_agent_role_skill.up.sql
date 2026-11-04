-- Skills granted by a role. An agent inherits every skill of the role it is
-- bound to (agent.role_id); there is no per-agent opt-out — the role is the
-- agent's job definition, and a skill attached to it is part of that job.
--
-- No foreign keys by repo policy: deleting a role, a skill or a workspace
-- cleans these rows in application code (the same places that already clear
-- agent.role_id and agent_skill).
CREATE TABLE agent_role_skill (
    role_id    UUID NOT NULL,
    skill_id   UUID NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, skill_id)
);
