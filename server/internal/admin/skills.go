package admin

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// The global skill pool. A global skill belongs to no workspace and every
// workspace can use it; the console is the only place a skill changes scope,
// so a workspace owner cannot publish into every tenant by accident.

type adminSkillResponse struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Roles        []string `json:"roles"`
	CreatorName  string   `json:"creator_name"`
	CreatorEmail string   `json:"creator_email"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
}

type adminWorkspaceSkillResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	UpdatedAt   string `json:"updated_at"`
}

type adminDemoteSkillRequest struct {
	WorkspaceID string `json:"workspace_id"`
}

// poolSkillToResponse renders one pool row: the list view needs the creator,
// which the join carries, plus the roles that grant it.
func poolSkillToResponse(row db.ListGlobalSkillsForAdminRow, roles []string) adminSkillResponse {
	if roles == nil {
		roles = []string{}
	}
	return adminSkillResponse{
		ID:           util.UUIDToString(row.ID),
		Name:         row.Name,
		Description:  row.Description,
		Roles:        roles,
		CreatorName:  row.CreatorName,
		CreatorEmail: row.CreatorEmail,
		CreatedAt:    timestampString(row.CreatedAt),
		UpdatedAt:    timestampString(row.UpdatedAt),
	}
}

// promotedSkillToResponse is the write path's result: a promotion has no role
// grants yet and the caller is the creator, so both stay empty.
func promotedSkillToResponse(skill db.Skill) adminSkillResponse {
	return adminSkillResponse{
		ID:          util.UUIDToString(skill.ID),
		Name:        skill.Name,
		Description: skill.Description,
		Roles:       []string{},
		CreatedAt:   timestampString(skill.CreatedAt),
		UpdatedAt:   timestampString(skill.UpdatedAt),
	}
}

// ListGlobalSkillsPage lists the global pool with the roles that grant each
// skill, so a demotion shows its impact before it happens.
func (h *Handler) ListGlobalSkillsPage(w http.ResponseWriter, r *http.Request) {
	skills, err := h.queries.ListGlobalSkillsForAdmin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list global skills")
		return
	}
	grants, err := h.queries.ListGlobalSkillRoleGrants(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list role grants")
		return
	}
	bySkill := make(map[string][]string, len(grants))
	for _, grant := range grants {
		key := util.UUIDToString(grant.SkillID)
		bySkill[key] = append(bySkill[key], grant.RoleName)
	}
	out := make([]adminSkillResponse, len(skills))
	for i, skill := range skills {
		out[i] = poolSkillToResponse(skill, bySkill[util.UUIDToString(skill.ID)])
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": out})
}

// ListWorkspaceSkillsPage lists what one workspace owns, the pool a skill can
// be promoted from.
func (h *Handler) ListWorkspaceSkillsPage(w http.ResponseWriter, r *http.Request) {
	workspaceID, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "workspace id")
	if !ok {
		return
	}
	if _, err := h.queries.GetAdminWorkspace(r.Context(), workspaceID); err != nil {
		writeDBError(w, err, "workspace not found", "failed to load workspace")
		return
	}
	skills, err := h.queries.ListWorkspaceSkillsForAdmin(r.Context(), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list workspace skills")
		return
	}
	out := make([]adminWorkspaceSkillResponse, 0, len(skills))
	for _, skill := range skills {
		out = append(out, adminWorkspaceSkillResponse{
			ID:          util.UUIDToString(skill.ID),
			Name:        skill.Name,
			Description: skill.Description,
			UpdatedAt:   timestampString(skill.UpdatedAt),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": out})
}

// PromoteSkill publishes a workspace skill into the global pool.
func (h *Handler) PromoteSkill(w http.ResponseWriter, r *http.Request) {
	skillID, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "skill id")
	if !ok {
		return
	}
	skill, err := h.queries.GetSkill(r.Context(), skillID)
	if err != nil {
		writeDBError(w, err, "skill not found", "failed to load skill")
		return
	}
	if !skill.WorkspaceID.Valid {
		writeError(w, http.StatusConflict, "skill is already global")
		return
	}
	// A plugin installation owns the skill lifecycle: uninstall removes the
	// skills it contributed, which a global skill would outlive.
	if skill.PluginInstallationID.Valid {
		writeError(w, http.StatusConflict, "plugin-provided skills cannot be made global")
		return
	}

	updated, err := h.queries.PromoteSkillToGlobal(r.Context(), db.PromoteSkillToGlobalParams{
		ID:          skill.ID,
		WorkspaceID: skill.WorkspaceID,
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			writeError(w, http.StatusConflict, "skill is no longer in its workspace")
		case isAdminUniqueViolation(err):
			writeError(w, http.StatusConflict, "a global skill with this name already exists")
		default:
			slog.Warn("platform admin promote skill failed", "skill_id", util.UUIDToString(skillID), "error", err)
			writeError(w, http.StatusInternalServerError, "failed to make skill global")
		}
		return
	}

	slog.Info("platform admin promoted skill",
		"skill_id", util.UUIDToString(updated.ID),
		"name", updated.Name,
		"workspace_id", util.UUIDToString(skill.WorkspaceID),
	)
	writeJSON(w, http.StatusOK, promotedSkillToResponse(updated))
}

// DemoteSkill moves one global skill back into a chosen workspace.
func (h *Handler) DemoteSkill(w http.ResponseWriter, r *http.Request) {
	skillID, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "skill id")
	if !ok {
		return
	}
	var req adminDemoteSkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	workspaceID, ok := parseUUIDParam(w, req.WorkspaceID, "workspace_id")
	if !ok {
		return
	}
	if _, err := h.queries.GetAdminWorkspace(r.Context(), workspaceID); err != nil {
		writeDBError(w, err, "workspace not found", "failed to load workspace")
		return
	}
	skill, err := h.queries.GetSkill(r.Context(), skillID)
	if err != nil {
		writeDBError(w, err, "skill not found", "failed to load skill")
		return
	}
	if skill.WorkspaceID.Valid {
		writeError(w, http.StatusConflict, "skill already belongs to a workspace")
		return
	}

	updated, err := h.queries.MoveSkillToWorkspace(r.Context(), db.MoveSkillToWorkspaceParams{
		ID:          skill.ID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			writeError(w, http.StatusConflict, "skill is no longer global")
		case isAdminUniqueViolation(err):
			writeError(w, http.StatusConflict, "a skill with this name already exists in that workspace")
		default:
			slog.Warn("platform admin demote skill failed", "skill_id", util.UUIDToString(skillID), "error", err)
			writeError(w, http.StatusInternalServerError, "failed to move skill to a workspace")
		}
		return
	}

	slog.Info("platform admin demoted skill",
		"skill_id", util.UUIDToString(updated.ID),
		"name", updated.Name,
		"workspace_id", util.UUIDToString(workspaceID),
	)
	writeJSON(w, http.StatusOK, adminWorkspaceSkillResponse{
		ID:          util.UUIDToString(updated.ID),
		Name:        updated.Name,
		Description: updated.Description,
		UpdatedAt:   timestampString(updated.UpdatedAt),
	})
}
