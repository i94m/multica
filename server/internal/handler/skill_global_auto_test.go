package handler

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/testutil"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// A global skill is a library entry, not an automatic grant: an agent only
// gets one through the role it is bound to.
func TestGlobalSkillRequiresRole(t *testing.T) {
	agentID := createHandlerTestAgent(t, "Global Requires Role Agent", nil)
	globalID := insertHandlerTestGlobalSkill(t, "global-role-"+t.Name(), "# Applies via role")

	// Without a role the skill is absent everywhere.
	var listed []SkillSummaryResponse
	testutil.Call(t, testHandler.ListAgentSkills, withURLParam(newRequest(
		"GET", "/api/agents/"+agentID+"/skills", nil,
	), "id", agentID)).Want(http.StatusOK).JSON(&listed)
	assertSkillIDsAbsent(t, listed, globalID)

	resolved, err := testHandler.Queries.ListAgentSkillsByIDs(context.Background(), db.ListAgentSkillsByIDsParams{
		AgentID:  parseUUID(agentID),
		SkillIds: []pgtype.UUID{parseUUID(globalID)},
	})
	if err != nil {
		t.Fatalf("ListAgentSkillsByIDs: %v", err)
	}
	if len(resolved) != 0 {
		t.Fatalf("global skill resolved without a role, got %+v", resolved)
	}

	// Grant it through a role: now it is part of the agent's effective set in
	// the management list, the execution load, and the per-skill resolve path.
	roleID := createRoleForSkillsTest(t, fmt.Sprintf("global-role-%d", time.Now().UnixNano()))
	if w := setRoleSkills(t, roleID, []string{globalID}); w.Code != http.StatusOK {
		t.Fatalf("SetAgentRoleSkills: %d %s", w.Code, w.Body.String())
	}
	dbfx.Exec(t, "UPDATE agent SET role_id = $1 WHERE id = $2", roleID, agentID)

	testutil.Call(t, testHandler.ListAgentSkills, withURLParam(newRequest(
		"GET", "/api/agents/"+agentID+"/skills", nil,
	), "id", agentID)).Want(http.StatusOK).JSON(&listed)
	assertSkillIDsPresent(t, listed, globalID)

	active, err := testHandler.Queries.ListAgentSkills(context.Background(), parseUUID(agentID))
	if err != nil {
		t.Fatalf("ListAgentSkills: %v", err)
	}
	if !containsSkillID(active, globalID) {
		t.Fatalf("role-granted global skill missing from execution load: %+v", active)
	}

	resolved, err = testHandler.Queries.ListAgentSkillsByIDs(context.Background(), db.ListAgentSkillsByIDsParams{
		AgentID:  parseUUID(agentID),
		SkillIds: []pgtype.UUID{parseUUID(globalID)},
	})
	if err != nil {
		t.Fatalf("ListAgentSkillsByIDs: %v", err)
	}
	if len(resolved) != 1 || uuidToString(resolved[0].ID) != globalID {
		t.Fatalf("role-granted global skill did not resolve, got %+v", resolved)
	}
}

// Global skills are applied by the platform, so per-agent toggles and removals
// are rejected instead of silently doing nothing.
func TestGlobalSkillRejectsPerAgentMutations(t *testing.T) {
	agentID := createHandlerTestAgent(t, "Global Auto Mutation Agent", nil)
	globalID := insertHandlerTestGlobalSkill(t, "global-mutation-"+t.Name(), "# Immutable")

	removeReq := withURLParams(newRequest(
		"DELETE", "/api/agents/"+agentID+"/skills/"+globalID, nil,
	), "id", agentID, "skillId", globalID)
	testutil.Call(t, testHandler.RemoveAgentSkill, removeReq).Want(http.StatusConflict)

	enabledReq := withURLParams(newRequest(
		"PUT", "/api/agents/"+agentID+"/skills/"+globalID+"/enabled", map[string]any{"enabled": false},
	), "id", agentID, "skillId", globalID)
	testutil.Call(t, testHandler.SetAgentSkillEnabled, enabledReq).Want(http.StatusConflict)

	assertAgentSkillRowCount(t, agentID, 0)
}

// Older clients still send every visible skill in the full replacement list.
// Global IDs are dropped so the save succeeds without creating dead rows.
func TestSetAgentSkillsDropsGlobalIDs(t *testing.T) {
	agentID := createHandlerTestAgent(t, "Global Auto Set Agent", nil)
	globalID := insertHandlerTestGlobalSkill(t, "global-set-"+t.Name(), "# Global")
	workspaceSkillID := insertHandlerTestSkill(t, "workspace-set", "# Workspace")

	testutil.Call(t, testHandler.SetAgentSkills, withURLParam(newRequest(
		"POST", "/api/agents/"+agentID+"/skills",
		map[string]any{"skill_ids": []string{globalID, workspaceSkillID}},
	), "id", agentID)).Want(http.StatusOK)

	assertAgentSkillRowCount(t, agentID, 1)
	var boundID string
	if err := testPool.QueryRow(context.Background(),
		`SELECT skill_id FROM agent_skill WHERE agent_id = $1`, agentID,
	).Scan(&boundID); err != nil {
		t.Fatalf("load bound skill: %v", err)
	}
	if boundID != workspaceSkillID {
		t.Fatalf("bound skill = %s, want workspace skill %s", boundID, workspaceSkillID)
	}

	var listed []SkillSummaryResponse
	testutil.Call(t, testHandler.ListAgentSkills, withURLParam(newRequest(
		"GET", "/api/agents/"+agentID+"/skills", nil,
	), "id", agentID)).Want(http.StatusOK).JSON(&listed)
	assertSkillIDsAbsent(t, listed, globalID)
	assertSkillIDsPresent(t, listed, workspaceSkillID)
}

func containsSkillID(skills []db.Skill, id string) bool {
	for _, skill := range skills {
		if uuidToString(skill.ID) == id {
			return true
		}
	}
	return false
}

func assertAgentSkillSummariesPresent(t *testing.T, skills []AgentSkillSummary, wantID string) {
	t.Helper()
	for _, skill := range skills {
		if skill.ID == wantID {
			return
		}
	}
	t.Fatalf("agent response missing skill %s; got %+v", wantID, skills)
}

func assertSkillIDsAbsent(t *testing.T, skills []SkillSummaryResponse, wantID string) {
	t.Helper()
	for _, skill := range skills {
		if skill.ID == wantID {
			t.Fatalf("skill %s present, want absent", wantID)
		}
	}
}
