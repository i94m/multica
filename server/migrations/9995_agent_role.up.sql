-- Reusable agent role prompts. A role with workspace_id IS NULL is global and
-- visible to every workspace; a workspace role belongs to exactly one.
CREATE TABLE agent_role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The role an agent explicitly selects. The workspace default role is applied
-- separately, so an agent may inherit both.
ALTER TABLE agent ADD COLUMN role_id UUID;

-- Every workspace can designate one role as the default inherited by all of
-- its user agents.
ALTER TABLE workspace ADD COLUMN default_agent_role_id UUID;
