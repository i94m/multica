package handler

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/testutil"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// A global skill is part of every agent's effective set without an
// agent_skill row: it must show up in management lists, agent responses, the
// execution load, and the per-skill resolve path.
func TestGlobalSkillAppliesWithoutAgentBinding(t *testing.T) {
	agentID := createHandlerTestAgent(t, "Global Auto Apply Agent", nil)
	globalID := insertHandlerTestGlobalSkill(t, "global-auto-"+t.Name(), "# Applies everywhere")

	var listed []SkillSummaryResponse
	testutil.Call(t, testHandler.ListAgentSkills, withURLParam(newRequest(
		"GET", "/api/agents/"+agentID+"/skills", nil,
	), "id", agentID)).Want(http.StatusOK).JSON(&listed)
	assertSkillIDsPresent(t, listed, globalID)
	for _, skill := range listed {
		if skill.ID != globalID {
			continue
		}
		if skill.Scope != skillScopeGlobal {
			t.Fatalf("scope = %q, want %q", skill.Scope, skillScopeGlobal)
		}
		if skill.Enabled == nil || !*skill.Enabled {
			t.Fatalf("global skill must report enabled, got %+v", skill)
		}
	}

	var agentResp AgentResponse
	testutil.Call(t, testHandler.GetAgent, withURLParam(newRequest(
		"GET", "/api/agents/"+agentID, nil,
	), "id", agentID)).Want(http.StatusOK).JSON(&agentResp)
	assertAgentSkillSummariesPresent(t, agentResp.Skills, globalID)

	var agents []AgentResponse
	testutil.Call(t, testHandler.ListAgents, newRequest("GET", "/api/agents", nil)).
		Want(http.StatusOK).JSON(&agents)
	foundAgent := false
	for _, agent := range agents {
		if agent.ID != agentID {
			continue
		}
		foundAgent = true
		assertAgentSkillSummariesPresent(t, agent.Skills, globalID)
	}
	if !foundAgent {
		t.Fatalf("agent %s missing from ListAgents", agentID)
	}

	active, err := testHandler.Queries.ListAgentSkills(context.Background(), parseUUID(agentID))
	if err != nil {
		t.Fatalf("ListAgentSkills: %v", err)
	}
	if !containsSkillID(active, globalID) {
		t.Fatalf("global skill missing from execution load: %+v", active)
	}

	resolved, err := testHandler.Queries.ListAgentSkillsByIDs(context.Background(), db.ListAgentSkillsByIDsParams{
		AgentID:  parseUUID(agentID),
		SkillIds: []pgtype.UUID{parseUUID(globalID)},
	})
	if err != nil {
		t.Fatalf("ListAgentSkillsByIDs: %v", err)
	}
	if len(resolved) != 1 || uuidToString(resolved[0].ID) != globalID {
		t.Fatalf("global skill must resolve without a binding, got %+v", resolved)
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
	assertSkillIDsPresent(t, listed, globalID, workspaceSkillID)
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
