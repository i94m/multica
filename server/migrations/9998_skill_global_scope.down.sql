-- Fork-only rollback: global rows cannot be represented once workspace_id is
-- NOT NULL again, so drop them before restoring the constraint.
DELETE FROM skill WHERE workspace_id IS NULL;
ALTER TABLE skill ALTER COLUMN workspace_id SET NOT NULL;
