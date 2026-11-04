package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/multica-ai/multica/server/internal/service"
	"github.com/multica-ai/multica/server/internal/testutil"
)

func insertRoleSkillSkill(t *testing.T, workspaceID, name, content string) string {
	t.Helper()
	cols := testutil.Cols{
		"name":        name,
		"description": name,
		"content":     content,
		"created_by":  testUserID,
	}
	if workspaceID != "" {
		cols["workspace_id"] = workspaceID
	}
	return dbfx.Insert(t, "skill", cols)
}

func createRoleForSkillsTest(t *testing.T, name string) string {
	t.Helper()
	// Roles are platform-level now: creating one requires a platform admin.
	dbfx.Exec(t, "INSERT INTO platform_admin (user_id) VALUES ($1) ON CONFLICT DO NOTHING", testUserID)
	dbfx.Cleanup(t, "DELETE FROM platform_admin WHERE user_id = $1", testUserID)

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/agent-roles", map[string]any{
		"name":         name,
		"description":  "role skills test",
		"instructions": "test instructions",
		"scope":        "workspace",
	})
	testHandler.CreateAgentRole(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateAgentRole: expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var role AgentRoleResponse
	if err := json.NewDecoder(w.Body).Decode(&role); err != nil {
		t.Fatalf("decode role: %v", err)
	}
	return role.ID
}

func setRoleSkills(t *testing.T, roleID string, skillIDs []string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := newRequest("PUT", "/api/agent-roles/"+roleID+"/skills", map[string]any{"skill_ids": skillIDs})
	req = withURLParam(req, "id", roleID)
	testHandler.SetAgentRoleSkills(w, req)
	return w
}

func listRoleSkills(t *testing.T, roleID string) []AgentSkillSummary {
	t.Helper()
	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/agent-roles/"+roleID+"/skills", nil)
	req = withURLParam(req, "id", roleID)
	testHandler.ListAgentRoleSkills(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListAgentRoleSkills: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Skills []AgentSkillSummary `json:"skills"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode role skills: %v", err)
	}
	return resp.Skills
}

// TestAgentRoleSkillsLifecycle covers the write/read path plus the two scope
// rules: a workspace role may carry its own workspace's skills and global
// skills, but two skills of the same name cannot coexist inside one role.
func TestAgentRoleSkillsLifecycle(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	roleID := createRoleForSkillsTest(t, fmt.Sprintf("skills-role-%d", time.Now().UnixNano()))
	globalA := insertRoleSkillSkill(t, "", "role-skill-a", "body a")
	globalB := insertRoleSkillSkill(t, "", "role-skill-b", "body b")

	if w := setRoleSkills(t, roleID, []string{globalA, globalB}); w.Code != http.StatusOK {
		t.Fatalf("SetAgentRoleSkills: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	skills := listRoleSkills(t, roleID)
	if len(skills) != 2 {
		t.Fatalf("role skills = %d, want 2: %v", len(skills), skills)
	}
	for _, s := range skills {
		if !s.Enabled {
			t.Fatalf("role skill %q reported disabled; role skills are always on", s.Name)
		}
		if s.Scope != "global" {
			t.Fatalf("role skill %q scope = %q, want global", s.Name, s.Scope)
		}
	}

	// A workspace-owned skill must not ride a role: it would carry one tenant's
	// private content into every workspace the role is visible in.
	workspaceSkill := insertRoleSkillSkill(t, testWorkspaceID, "role-skill-workspace", "private body")
	if w := setRoleSkills(t, roleID, []string{workspaceSkill}); w.Code != http.StatusBadRequest {
		t.Fatalf("workspace skill in role: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Plain members cannot edit a role's skills.
	memberID := dbfx.User(t, "Role Skills Member", fmt.Sprintf("role-skills-member-%d@multica.ai", time.Now().UnixNano()))
	dbfx.Member(t, testWorkspaceID, memberID, "member")
	w := httptest.NewRecorder()
	req := newRequestAs(memberID, "PUT", "/api/agent-roles/"+roleID+"/skills", map[string]any{"skill_ids": []string{workspaceSkill}})
	req = withURLParam(req, "id", roleID)
	testHandler.SetAgentRoleSkills(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("member set: expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

// TestAgentRoleSkillReplacesPerAgentBindings: a skill that joins a role becomes
// mandatory for every agent on that role, so the agent's own binding row (which
// could read "disabled") must be removed in the same write.
func TestAgentRoleSkillReplacesPerAgentBindings(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	roleID := createRoleForSkillsTest(t, fmt.Sprintf("skills-cleanup-role-%d", time.Now().UnixNano()))
	skillID := insertRoleSkillSkill(t, "", "role-skill-cleanup", "body")
	agentID := dbfx.Agent(t, "role-skills-cleanup-agent", "", testutil.Cols{"role_id": roleID})
	dbfx.InsertNoID(t, "agent_skill", testutil.Cols{
		"agent_id": agentID,
		"skill_id": skillID,
		"enabled":  false,
	}, "agent_id = $1 AND skill_id = $2", agentID, skillID)

	if w := setRoleSkills(t, roleID, []string{skillID}); w.Code != http.StatusOK {
		t.Fatalf("SetAgentRoleSkills: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if n := dbfx.Count(t, "SELECT count(*) FROM agent_skill WHERE agent_id = $1 AND skill_id = $2", agentID, skillID); n != 0 {
		t.Fatalf("agent_skill rows after role grant = %d, want 0", n)
	}

	// The skill now reaches the agent through the role, and the daemon's
	// per-ref authorization must resolve it — otherwise the claim lists a
	// bundle the daemon then 404s on.
	ref := service.AgentSkillBundleRef{ID: skillID, Source: "workspace"}
	got, err := testHandler.TaskService.LoadRequestedAgentSkillBundles(context.Background(), parseUUID(agentID), []service.AgentSkillBundleRef{ref})
	if err != nil {
		t.Fatalf("LoadRequestedAgentSkillBundles: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("daemon resolved %d bundles, want 1 (role-granted skill must be fetchable)", len(got))
	}
}

// TestAgentRoleSkillsGlobalRoleRequiresPlatformAdmin pins the permission split:
// a global role reaches every workspace, so only a platform admin may create it
// (and, by the same helper, edit its skills).
func TestAgentRoleSkillsGlobalRoleRequiresPlatformAdmin(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/agent-roles", map[string]any{
		"name":         fmt.Sprintf("global-role-%d", time.Now().UnixNano()),
		"instructions": "x",
		"scope":        "global",
	})
	testHandler.CreateAgentRole(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("global role as non-platform-admin: expected 403, got %d: %s", w.Code, w.Body.String())
	}

	// Grant platform admin and retry: the same request now succeeds.
	dbfx.Exec(t, "INSERT INTO platform_admin (user_id) VALUES ($1)", testUserID)
	dbfx.Cleanup(t, "DELETE FROM platform_admin WHERE user_id = $1", testUserID)
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/agent-roles", map[string]any{
		"name":         fmt.Sprintf("global-role-%d", time.Now().UnixNano()),
		"instructions": "x",
		"scope":        "global",
	})
	testHandler.CreateAgentRole(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("global role as platform admin: expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var role AgentRoleResponse
	if err := json.NewDecoder(w.Body).Decode(&role); err != nil {
		t.Fatalf("decode global role: %v", err)
	}
	if role.Scope != "global" {
		t.Fatalf("created scope = %q, want global", role.Scope)
	}

	// A global role may only grant global skills.
	workspaceSkill := insertRoleSkillSkill(t, testWorkspaceID, "global-role-workspace-skill", "body")
	if w := setRoleSkills(t, role.ID, []string{workspaceSkill}); w.Code != http.StatusBadRequest {
		t.Fatalf("global role with workspace skill: expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
