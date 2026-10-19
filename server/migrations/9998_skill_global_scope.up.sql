-- Global skills are ordinary skill rows with no owning workspace. They are
-- visible to every workspace and can be bound to agents in any workspace.
ALTER TABLE skill ALTER COLUMN workspace_id DROP NOT NULL;
