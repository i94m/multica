package handler

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/multica-ai/multica/server/internal/testutil"
)

// A global skill is the shared library; it must leave the global scope before
// it can be deleted, so one workspace cannot remove a skill other workspaces
// and roles rely on.
func TestDeleteGlobalSkillRequiresUnsetFirst(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	globalID := insertHandlerTestGlobalSkill(t, "global-delete-"+t.Name(), "# Shared")

	req := withURLParam(newRequest("DELETE", "/api/skills/"+globalID, nil), "id", globalID)
	testutil.Call(t, testHandler.DeleteSkill, req).Want(http.StatusConflict)

	// Moving it back into a workspace makes it deletable again.
	testutil.Call(t, testHandler.SetSkillScope, setSkillScopeRequest(t, globalID, "", "workspace")).
		Want(http.StatusOK)
	req = withURLParam(newRequest("DELETE", "/api/skills/"+globalID, nil), "id", globalID)
	testutil.Call(t, testHandler.DeleteSkill, req).Want(http.StatusNoContent)
}

// The skills list carries the roles that grant each skill, so the table can
// show the association without a request per row.
func TestListSkillsReportsGrantingRoles(t *testing.T) {
	if testHandler == nil {
		t.Skip("database not available")
	}

	skillID := insertHandlerTestGlobalSkill(t, "role-grant-"+t.Name(), "# body")
	roleName := fmt.Sprintf("granting-role-%d", time.Now().UnixNano())
	roleID := createRoleForSkillsTest(t, roleName)
	if w := setRoleSkills(t, roleID, []string{skillID}); w.Code != http.StatusOK {
		t.Fatalf("SetAgentRoleSkills: %d %s", w.Code, w.Body.String())
	}

	var rows []SkillSummaryResponse
	testutil.Call(t, testHandler.ListSkills, newRequest("GET", "/api/skills", nil)).
		Want(http.StatusOK).
		JSON(&rows)

	for _, row := range rows {
		if row.ID != skillID {
			continue
		}
		for _, name := range row.RoleNames {
			if name == roleName {
				return
			}
		}
		t.Fatalf("skill %s role_names = %v, want it to include %q", skillID, row.RoleNames, roleName)
	}
	t.Fatalf("skill %s missing from ListSkills", skillID)
}
