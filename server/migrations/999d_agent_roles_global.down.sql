-- Irreversible: the pre-migration workspace of a globalized role is not
-- recorded, so there is nothing to restore. The down direction leaves every
-- role global.
SELECT 1;
