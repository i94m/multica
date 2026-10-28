package handler

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/multica-ai/multica/server/internal/testutil"
)

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

func setSkillScopeRequest(t *testing.T, skillID, workspaceID, scope string) *http.Request {
	t.Helper()
	req := newRequest("PUT", "/api/skills/"+skillID+"/scope", map[string]any{
		"scope": scope,
	})
	req = withURLParam(req, "id", skillID)
	if workspaceID != "" {
		req.Header.Set("X-Workspace-ID", workspaceID)
	}
	return req
}

func TestSetSkillScopePromotePreservesBindingsAndMakesSkillVisible(t *testing.T) {
	agentID := createHandlerTestAgent(t, "Global Skill Promote Agent", nil)
	skillID := insertHandlerTestSkill(t, "global-promote", "# Global me")
	if _, err := testPool.Exec(context.Background(),
		`INSERT INTO agent_skill (agent_id, skill_id) VALUES ($1, $2)`,
		agentID, skillID,
	); err != nil {
		t.Fatalf("attach skill to agent: %v", err)
	}

	var resp SkillResponse
	testutil.Call(t, testHandler.SetSkillScope, setSkillScopeRequest(t, skillID, "", "global")).
		Want(http.StatusOK).
		JSON(&resp)

	if resp.Scope != skillScopeGlobal {
		t.Fatalf("scope = %q, want %q", resp.Scope, skillScopeGlobal)
	}
	if resp.WorkspaceID != "" {
		t.Fatalf("workspace_id = %q, want empty", resp.WorkspaceID)
	}

	var workspaceIsNull bool
	dbfx.QueryRow(t, `SELECT workspace_id IS NULL FROM skill WHERE id = $1`, skillID).Scan(&workspaceIsNull)
	if !workspaceIsNull {
		t.Fatalf("workspace_id = NULL, want global row")
	}

	// The existing agent binding survives the scope change.
	assertAgentSkillRowCount(t, agentID, 1)

	// A different workspace sees the global skill in its list.
	otherWorkspaceID := dbfx.Workspace(t, "Global Skill Other Workspace", "global-skill-other-"+fmt.Sprint(time.Now().UnixNano()))
	req := newRequest("GET", "/api/skills", nil)
	req.Header.Set("X-Workspace-ID", otherWorkspaceID)
	var rows []SkillSummaryResponse
	testutil.Call(t, testHandler.ListSkills, req).Want(http.StatusOK).JSON(&rows)
	assertSkillIDsPresent(t, rows, skillID)

	// A fresh agent gets it automatically: adding a global skill is a no-op
	// because it is already part of every agent's effective set.
	otherAgentID := createHandlerTestAgent(t, "Global Skill Bind Agent", nil)
	testutil.Call(t, testHandler.AddAgentSkills, withURLParam(newRequest(
		"POST",
		"/api/agents/"+otherAgentID+"/skills/add",
		map[string]any{"skill_ids": []string{skillID}},
	), "id", otherAgentID)).Want(http.StatusOK)
	assertAgentSkillRowCount(t, otherAgentID, 0)

	var agentSkills []SkillSummaryResponse
	testutil.Call(t, testHandler.ListAgentSkills, withURLParam(newRequest(
		"GET", "/api/agents/"+otherAgentID+"/skills", nil,
	), "id", otherAgentID)).Want(http.StatusOK).JSON(&agentSkills)
	assertSkillIDsPresent(t, agentSkills, skillID)
}

func TestSetSkillScopeDemoteMovesGlobalSkillToCurrentWorkspace(t *testing.T) {
	skillID := insertHandlerTestGlobalSkill(t, "global-demote-"+t.Name(), "# Demote me")

	var resp SkillResponse
	testutil.Call(t, testHandler.SetSkillScope, setSkillScopeRequest(t, skillID, "", "workspace")).
		Want(http.StatusOK).
		JSON(&resp)

	if resp.Scope != skillScopeWorkspace {
		t.Fatalf("scope = %q, want %q", resp.Scope, skillScopeWorkspace)
	}
	if resp.WorkspaceID != testWorkspaceID {
		t.Fatalf("workspace_id = %q, want %q", resp.WorkspaceID, testWorkspaceID)
	}
}

func TestSetSkillScopePromoteRequiresWorkspaceAdmin(t *testing.T) {
	skillID := insertHandlerTestSkill(t, "global-member-denied", "# No")

	memberID := dbfx.User(t, "Global Skill Member", fmt.Sprintf("global-skill-member-%d@example.com", time.Now().UnixNano()))
	dbfx.Member(t, testWorkspaceID, memberID, "member")

	req := setSkillScopeRequest(t, skillID, "", "global")
	req.Header.Set("X-User-ID", memberID)
	testutil.Call(t, testHandler.SetSkillScope, req).Want(http.StatusForbidden)
}

func TestSetSkillScopePromoteRejectsGlobalNameConflict(t *testing.T) {
	name := "global-name-conflict-" + t.Name()
	insertHandlerTestGlobalSkill(t, name, "# Global")
	skillID := dbfx.Insert(t, "skill", testutil.Cols{
		"workspace_id": testWorkspaceID,
		"name":         name,
		"description":  "fixture",
		"content":      "# Workspace",
		"config":       testutil.Raw("'{}'::jsonb"),
		"created_by":   testUserID,
	})

	testutil.Call(t, testHandler.SetSkillScope, setSkillScopeRequest(t, skillID, "", "global")).
		Want(http.StatusConflict)
}

func TestSetSkillScopePromoteRejectsPluginSkill(t *testing.T) {
	skillID := dbfx.Insert(t, "skill", testutil.Cols{
		"workspace_id":           testWorkspaceID,
		"name":                   "global-plugin-skill-" + t.Name(),
		"description":            "fixture",
		"content":                "# Plugin",
		"config":                 testutil.Raw("'{}'::jsonb"),
		"created_by":             testUserID,
		"plugin_installation_id": testutil.Raw("gen_random_uuid()"),
	})

	testutil.Call(t, testHandler.SetSkillScope, setSkillScopeRequest(t, skillID, "", "global")).
		Want(http.StatusConflict)
}
