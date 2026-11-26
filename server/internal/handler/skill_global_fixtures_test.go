package handler

import (
	"context"
	"testing"
)

// insertHandlerTestGlobalSkill seeds a skill with no owning workspace.
func insertHandlerTestGlobalSkill(t *testing.T, name, content string) string {
	t.Helper()
	var id string
	if err := testPool.QueryRow(context.Background(), `
		INSERT INTO skill (workspace_id, name, description, content, config, created_by)
		VALUES (NULL, $1, 'fixture', $2, '{}'::jsonb, $3)
		RETURNING id
	`, name, content, testUserID).Scan(&id); err != nil {
		t.Fatalf("insert global skill: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM skill WHERE id = $1`, id)
	})
	return id
}
