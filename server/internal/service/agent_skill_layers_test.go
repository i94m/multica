package service

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func skillOf(id byte, name string) db.Skill {
	var u pgtype.UUID
	u.Bytes[15] = id
	u.Valid = true
	return db.Skill{ID: u, Name: name}
}

// TestMergeAgentSkillLayers pins the precedence rule fixed for role-bound
// skills: role > agent > global, deduped by id first and by name second.
func TestMergeAgentSkillLayers(t *testing.T) {
	roleSkills := []db.Skill{skillOf(1, "shared"), skillOf(2, "role-only")}
	agentSkills := []db.Skill{skillOf(3, "shared"), skillOf(4, "agent-only"), skillOf(1, "shared")}
	globalSkills := []db.Skill{skillOf(5, "shared"), skillOf(6, "global-only")}

	merged, grants := mergeAgentSkillLayers("agent-1", []agentSkillLayer{
		{source: AgentSkillGrantRole, skills: roleSkills},
		{source: AgentSkillGrantAgent, skills: agentSkills},
		{source: AgentSkillGrantGlobal, skills: globalSkills},
	})

	wantOrder := []string{"agent-only", "global-only", "role-only", "shared"}
	if len(merged) != len(wantOrder) {
		t.Fatalf("merged %d skills, want %d: %v", len(merged), len(wantOrder), names(merged))
	}
	for i, want := range wantOrder {
		if merged[i].Name != want {
			t.Fatalf("merged[%d] = %q, want %q (order %v)", i, merged[i].Name, want, names(merged))
		}
	}

	// The shared name resolves to the ROLE's row: the role is the agent's job
	// definition and cannot be overridden by a lower layer.
	if merged[3].ID.Bytes[15] != 1 {
		t.Fatalf("shared skill resolves to id byte %d, want the role's (1)", merged[3].ID.Bytes[15])
	}
	wantGrants := map[byte]string{4: AgentSkillGrantAgent, 6: AgentSkillGrantGlobal, 2: AgentSkillGrantRole, 1: AgentSkillGrantRole}
	for id, want := range wantGrants {
		got := grants[skillIDOf(id)]
		if got != want {
			t.Fatalf("grant for skill %d = %q, want %q", id, got, want)
		}
	}
}

// TestMergeAgentSkillLayersEmpty covers the common case: no role, no bindings,
// no global skills — the caller gets a nil set, not an empty layer artifact.
func TestMergeAgentSkillLayersEmpty(t *testing.T) {
	merged, grants := mergeAgentSkillLayers("agent-1", []agentSkillLayer{
		{source: AgentSkillGrantRole},
		{source: AgentSkillGrantAgent},
		{source: AgentSkillGrantGlobal},
	})
	if len(merged) != 0 || len(grants) != 0 {
		t.Fatalf("expected empty merge, got %d skills / %d grants", len(merged), len(grants))
	}
}

func names(skills []db.Skill) []string {
	out := make([]string, len(skills))
	for i, s := range skills {
		out[i] = s.Name
	}
	return out
}

func skillIDOf(id byte) string {
	var u pgtype.UUID
	u.Bytes[15] = id
	u.Valid = true
	return util.UUIDToString(u)
}
