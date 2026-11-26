package admin

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/multica-ai/multica/server/internal/testutil"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// The console is the only place a skill changes scope, so these tests cover
// the promote and demote paths that used to live in the workspace handler.

func newSkillsTest(t *testing.T) (*Handler, *testutil.Fixture, string) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	fixture := testutil.New(pool, "", "")
	suffix := time.Now().UnixNano()
	workspaceID := fixture.Insert(t, "workspace", testutil.Cols{
		"name": fmt.Sprintf("skills-console-%d", suffix),
		"slug": fmt.Sprintf("skills-console-%d", suffix),
	})
	return &Handler{queries: db.New(pool)}, fixture, workspaceID
}

func newAdminSkillRequest(t *testing.T, method, path, id, body string) *http.Request {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
	}
	routeCtx := chi.NewRouteContext()
	routeCtx.URLParams.Add("id", id)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, routeCtx))
}

func insertAdminSkill(t *testing.T, fixture *testutil.Fixture, workspaceID, name string, plugin bool) string {
	t.Helper()
	cols := testutil.Cols{
		"name":    name,
		"content": "# body",
		"config":  testutil.Raw("'{}'::jsonb"),
	}
	if workspaceID != "" {
		cols["workspace_id"] = workspaceID
	}
	if plugin {
		cols["plugin_installation_id"] = testutil.Raw("gen_random_uuid()")
	}
	return fixture.Insert(t, "skill", cols)
}

func TestPromoteSkillKeepsAgentBindings(t *testing.T) {
	handler, fixture, workspaceID := newSkillsTest(t)
	skillID := insertAdminSkill(t, fixture, workspaceID, "promote-"+t.Name(), false)
	agentID := fixture.Insert(t, "agent", testutil.Cols{
		"workspace_id": workspaceID,
		"name":         "promote-agent",
		"runtime_mode": "local",
	})
	fixture.InsertNoID(t, "agent_skill",
		testutil.Cols{"agent_id": agentID, "skill_id": skillID},
		"agent_id = $1 AND skill_id = $2", agentID, skillID)

	var resp adminSkillResponse
	testutil.Call(t, handler.PromoteSkill,
		newAdminSkillRequest(t, "POST", "/api/admin/skills/"+skillID+"/promote", skillID, "")).
		Want(http.StatusOK).
		JSON(&resp)

	if resp.ID != skillID {
		t.Fatalf("promoted skill id = %q, want %q", resp.ID, skillID)
	}
	var workspace *string
	if err := fixture.Pool.QueryRow(context.Background(),
		`SELECT workspace_id::text FROM skill WHERE id = $1`, skillID).Scan(&workspace); err != nil {
		t.Fatalf("read promoted skill: %v", err)
	}
	if workspace != nil {
		t.Fatalf("promoted skill workspace_id = %v, want NULL", *workspace)
	}
	var bindings int
	if err := fixture.Pool.QueryRow(context.Background(),
		`SELECT count(*) FROM agent_skill WHERE skill_id = $1`, skillID).Scan(&bindings); err != nil {
		t.Fatalf("count agent bindings: %v", err)
	}
	if bindings != 1 {
		t.Fatalf("agent bindings = %d, want the existing binding kept", bindings)
	}
}

func TestDemoteSkillMovesToChosenWorkspace(t *testing.T) {
	handler, fixture, workspaceID := newSkillsTest(t)
	skillID := insertAdminSkill(t, fixture, "", "demote-"+t.Name(), false)

	var resp adminWorkspaceSkillResponse
	testutil.Call(t, handler.DemoteSkill,
		newAdminSkillRequest(t, "POST", "/api/admin/global-skills/"+skillID+"/demote", skillID,
			fmt.Sprintf(`{"workspace_id":%q}`, workspaceID))).
		Want(http.StatusOK).
		JSON(&resp)

	var owner string
	if err := fixture.Pool.QueryRow(context.Background(),
		`SELECT workspace_id::text FROM skill WHERE id = $1`, skillID).Scan(&owner); err != nil {
		t.Fatalf("read demoted skill: %v", err)
	}
	if owner != workspaceID {
		t.Fatalf("demoted skill workspace_id = %q, want %q", owner, workspaceID)
	}
}

func TestPromoteSkillRejectsGlobalNameConflict(t *testing.T) {
	handler, fixture, workspaceID := newSkillsTest(t)
	name := "conflict-" + t.Name()
	insertAdminSkill(t, fixture, "", name, false)
	skillID := insertAdminSkill(t, fixture, workspaceID, name, false)

	testutil.Call(t, handler.PromoteSkill,
		newAdminSkillRequest(t, "POST", "/api/admin/skills/"+skillID+"/promote", skillID, "")).
		Want(http.StatusConflict)
}

func TestPromoteSkillRejectsPluginSkill(t *testing.T) {
	handler, fixture, workspaceID := newSkillsTest(t)
	skillID := insertAdminSkill(t, fixture, workspaceID, "plugin-"+t.Name(), true)

	testutil.Call(t, handler.PromoteSkill,
		newAdminSkillRequest(t, "POST", "/api/admin/skills/"+skillID+"/promote", skillID, "")).
		Want(http.StatusConflict)
}

func TestPromoteSkillRejectsGlobalSkill(t *testing.T) {
	handler, fixture, _ := newSkillsTest(t)
	skillID := insertAdminSkill(t, fixture, "", "already-global-"+t.Name(), false)

	testutil.Call(t, handler.PromoteSkill,
		newAdminSkillRequest(t, "POST", "/api/admin/skills/"+skillID+"/promote", skillID, "")).
		Want(http.StatusConflict)
}

func TestDemoteSkillRejectsUnknownWorkspace(t *testing.T) {
	handler, fixture, _ := newSkillsTest(t)
	skillID := insertAdminSkill(t, fixture, "", "unknown-ws-"+t.Name(), false)

	testutil.Call(t, handler.DemoteSkill,
		newAdminSkillRequest(t, "POST", "/api/admin/global-skills/"+skillID+"/demote", skillID,
			`{"workspace_id":"00000000-0000-0000-0000-000000000000"}`)).
		Want(http.StatusNotFound)
}
