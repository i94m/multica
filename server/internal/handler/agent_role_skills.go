package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/platformadmin"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Role-bound skills. An agent inherits every skill of the role it is bound to
// (agent.role_id) and cannot switch one off — the role is the agent's job
// definition. The effective set at claim time is role ∪ agent-bound ∪ global,
// merged by mergeAgentSkillLayers in the task service.

type setAgentRoleSkillsRequest struct {
	SkillIDs []string `json:"skill_ids"`
}

// maxRoleSkills bounds one role's skill set. A role is a starter kit, not a
// library: the cap keeps the hand-off payload and the per-run skill directory
// small enough to stay predictable.
const maxRoleSkills = 50

// roleWriteAllowed gates role mutations.
//
// A workspace role is workspace configuration, so its workspace owners/admins
// may edit it. A global role is visible in every workspace, and now that a role
// can carry skills, editing one is an instance-level action that reaches every
// tenant — it requires a platform admin (the same grant the admin console uses).
func (h *Handler) roleWriteAllowed(w http.ResponseWriter, r *http.Request, workspaceID string, role db.AgentRole) bool {
	if role.WorkspaceID.Valid {
		return h.roleAdmin(w, r, workspaceID)
	}
	if !h.requirePlatformAdmin(w, r) {
		return false
	}
	return true
}

// requirePlatformAdmin mirrors the admin console's check: the platform_admin
// table is authoritative, with the bootstrap allowlist applied as a fallback so
// a fresh deployment can still name its first administrator.
func (h *Handler) requirePlatformAdmin(w http.ResponseWriter, r *http.Request) bool {
	userID := requestUserID(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "user not authenticated")
		return false
	}
	uid, err := util.ParseUUID(userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid user identity")
		return false
	}
	ok, err := h.Queries.IsPlatformAdmin(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify platform admin")
		return false
	}
	if ok {
		return true
	}
	user, err := h.Queries.GetUser(r.Context(), uid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusForbidden, "platform admin access required")
			return false
		}
		writeError(w, http.StatusInternalServerError, "failed to verify platform admin")
		return false
	}
	if platformadmin.ConfigFromEnv().Allows(user.Email) {
		return true
	}
	writeError(w, http.StatusForbidden, "platform admin access required")
	return false
}

// ListAgentRoleSkills returns the skills a role grants. Read access follows the
// role's visibility: any workspace member who can see the role can see what it
// hands to its agents.
func (h *Handler) ListAgentRoleSkills(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	role, ok := h.loadRoleVisible(w, r, workspaceID)
	if !ok {
		return
	}
	skills, err := h.Queries.ListRoleSkills(r.Context(), role.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list role skills")
		return
	}
	resp := make([]AgentSkillSummary, len(skills))
	for i, s := range skills {
		resp[i] = AgentSkillSummary{
			ID:          uuidToString(s.ID),
			Scope:       skillScope(s.WorkspaceID),
			Name:        s.Name,
			Description: s.Description,
			Enabled:     true,
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": resp})
}

// SetAgentRoleSkills replaces a role's skill set. The whole set is sent at once
// so the role page saves in one request; per-skill add/remove would race a
// second editor against the same list.
func (h *Handler) SetAgentRoleSkills(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	role, ok := h.loadRoleVisible(w, r, workspaceID)
	if !ok {
		return
	}
	if !h.roleWriteAllowed(w, r, workspaceID, role) {
		return
	}

	var req setAgentRoleSkillsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.SkillIDs) > maxRoleSkills {
		writeError(w, http.StatusBadRequest, "a role can carry at most 50 skills")
		return
	}

	skills, msg := h.resolveRoleSkills(r.Context(), role, req.SkillIDs)
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	skillIDs := make([]pgtype.UUID, len(skills))
	for i, s := range skills {
		skillIDs[i] = s.ID
	}

	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())
	qtx := h.Queries.WithTx(tx)

	// A skill that joins a role becomes mandatory for every agent bound to it.
	// Any per-agent binding row for the same skill would read "disabled" while
	// the skill still applies, so drop those rows in the same transaction.
	if len(skillIDs) > 0 {
		if err := qtx.DeleteAgentSkillBindingsForRole(r.Context(), db.DeleteAgentSkillBindingsForRoleParams{
			RoleID:   role.ID,
			SkillIds: skillIDs,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to clear per-agent bindings")
			return
		}
	}
	if err := qtx.DeleteRoleSkillsByRole(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to replace role skills")
		return
	}
	for i, s := range skills {
		if err := qtx.AddRoleSkill(r.Context(), db.AddRoleSkillParams{
			RoleID:   role.ID,
			SkillID:  s.ID,
			Position: int32(i),
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save role skills")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit role skills")
		return
	}

	resp := make([]AgentSkillSummary, len(skills))
	for i, s := range skills {
		resp[i] = AgentSkillSummary{
			ID:          uuidToString(s.ID),
			Scope:       skillScope(s.WorkspaceID),
			Name:        s.Name,
			Description: s.Description,
			Enabled:     true,
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": resp})
}

// resolveRoleSkills loads and validates a requested skill set for a role.
//
// Two rules decide what a role may carry:
//   - Scope: a global role belongs to every workspace, so it may only grant
//     global skills. A workspace role may grant its own workspace's skills plus
//     globals. Anything else would ship one tenant's private skill content to
//     another.
//   - Name uniqueness inside the set: the execution environment materializes
//     skills into a per-name directory, so two skills of the same name in one
//     role would silently overwrite each other. Cross-layer collisions are
//     resolved by precedence at claim time; an intra-role collision is a
//     configuration error and is rejected here.
//
// Order is preserved — it is the order the role page shows and the position
// stored with each binding.
func (h *Handler) resolveRoleSkills(ctx context.Context, role db.AgentRole, requested []string) ([]db.Skill, string) {
	out := make([]db.Skill, 0, len(requested))
	seenID := make(map[string]struct{}, len(requested))
	seenName := make(map[string]struct{}, len(requested))

	for _, raw := range requested {
		id, err := util.ParseUUID(strings.TrimSpace(raw))
		if err != nil {
			return nil, "invalid skill id"
		}
		key := util.UUIDToString(id)
		if _, ok := seenID[key]; ok {
			continue
		}
		skill, err := h.Queries.GetSkill(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, "skill not found"
			}
			return nil, "failed to load skill"
		}
		if role.WorkspaceID.Valid {
			if skill.WorkspaceID.Valid && util.UUIDToString(skill.WorkspaceID) != util.UUIDToString(role.WorkspaceID) {
				return nil, "a role can only carry skills from its own workspace or global skills"
			}
		} else if skill.WorkspaceID.Valid {
			return nil, "a global role can only carry global skills"
		}
		name := strings.ToLower(strings.TrimSpace(skill.Name))
		if _, ok := seenName[name]; ok {
			return nil, "two skills in this role share the name " + skill.Name
		}
		seenID[key] = struct{}{}
		seenName[name] = struct{}{}
		out = append(out, skill)
	}
	return out, ""
}

// roleSkillCount returns how many skills a role grants, for list responses.
func (h *Handler) roleSkillCount(ctx context.Context, roleID pgtype.UUID) int64 {
	skills, err := h.Queries.ListRoleSkills(ctx, roleID)
	if err != nil {
		return 0
	}
	return int64(len(skills))
}
