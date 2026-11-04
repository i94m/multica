package admin

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Role management for the platform console. Roles are platform-level: every
// role is global, carries a prompt, and may grant global skills to the agents
// bound to it. This is the only place roles can be created or edited.

type adminRoleResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Instructions string `json:"instructions"`
	AgentCount   int64  `json:"agent_count"`
	SkillCount   int64  `json:"skill_count"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type adminRoleSkillResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type adminRoleRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	Instructions string `json:"instructions"`
}

type adminRoleSkillsRequest struct {
	SkillIDs []string `json:"skill_ids"`
}

const maxRoleSkills = 50

func adminRoleToResponse(row db.ListAllAgentRolesRow) adminRoleResponse {
	return adminRoleResponse{
		ID:           util.UUIDToString(row.ID),
		Name:         row.Name,
		Description:  row.Description,
		Instructions: row.Instructions,
		AgentCount:   row.AgentCount,
		SkillCount:   row.SkillCount,
		CreatedAt:    row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:    row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func (h *Handler) ListAgentRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListAllAgentRoles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list roles")
		return
	}
	out := make([]adminRoleResponse, len(rows))
	for i, row := range rows {
		out[i] = adminRoleToResponse(row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"roles": out})
}

// ListGlobalSkills returns the pool roles may grant. Only global skills are
// eligible, so this is the whole picker.
func (h *Handler) ListGlobalSkills(w http.ResponseWriter, r *http.Request) {
	skills, err := h.queries.ListGlobalSkillsForAdmin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list skills")
		return
	}
	out := make([]adminRoleSkillResponse, len(skills))
	for i, s := range skills {
		out[i] = adminRoleSkillResponse{
			ID:          util.UUIDToString(s.ID),
			Name:        s.Name,
			Description: s.Description,
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": out})
}

func normalizeRoleInput(req adminRoleRequest) (string, string, string, string) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return "", "", "", "name is required"
	}
	return name, strings.TrimSpace(req.Description), strings.TrimSpace(req.Instructions), ""
}

func (h *Handler) CreateAgentRole(w http.ResponseWriter, r *http.Request) {
	var req adminRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, description, instructions, msg := normalizeRoleInput(req)
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	userID := r.Header.Get("X-User-ID")
	creator, err := util.ParseUUID(userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid user identity")
		return
	}
	role, err := h.queries.CreateAgentRole(r.Context(), db.CreateAgentRoleParams{
		Name:         name,
		Description:  description,
		Instructions: instructions,
		CreatedBy:    creator,
	})
	if err != nil {
		if isAdminUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a role with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create role")
		return
	}
	slog.Info("platform admin created role", "user_id", userID, "role_id", util.UUIDToString(role.ID))
	writeJSON(w, http.StatusCreated, adminRoleResponse{
		ID:           util.UUIDToString(role.ID),
		Name:         role.Name,
		Description:  role.Description,
		Instructions: role.Instructions,
		CreatedAt:    role.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:    role.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

func (h *Handler) UpdateAgentRole(w http.ResponseWriter, r *http.Request) {
	role, ok := h.loadRole(w, r)
	if !ok {
		return
	}
	var req adminRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, description, instructions, msg := normalizeRoleInput(req)
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	updated, err := h.queries.UpdateAgentRole(r.Context(), db.UpdateAgentRoleParams{
		ID:           role.ID,
		Name:         name,
		Description:  description,
		Instructions: instructions,
	})
	if err != nil {
		if isAdminUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a role with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	slog.Info("platform admin updated role", "user_id", r.Header.Get("X-User-ID"), "role_id", util.UUIDToString(updated.ID))
	count, _ := h.queries.CountAgentsUsingRole(r.Context(), updated.ID)
	writeJSON(w, http.StatusOK, adminRoleResponse{
		ID:           util.UUIDToString(updated.ID),
		Name:         updated.Name,
		Description:  updated.Description,
		Instructions: updated.Instructions,
		AgentCount:   count,
		CreatedAt:    updated.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:    updated.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

func (h *Handler) DeleteAgentRole(w http.ResponseWriter, r *http.Request) {
	role, ok := h.loadRole(w, r)
	if !ok {
		return
	}
	// The console's handler has no transaction starter; do the statements in
	// order. Detaching first means a failure between them leaves agents unbound
	// but the role intact — recoverable, unlike the reverse.
	if err := h.queries.ClearAgentRoleReferences(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to detach role from agents")
		return
	}
	if err := h.queries.DeleteRoleSkillsByRole(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove role skills")
		return
	}
	if err := h.queries.DeleteAgentRole(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete role")
		return
	}
	slog.Info("platform admin deleted role", "user_id", r.Header.Get("X-User-ID"), "role_id", util.UUIDToString(role.ID))
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListAgentRoleSkills(w http.ResponseWriter, r *http.Request) {
	role, ok := h.loadRole(w, r)
	if !ok {
		return
	}
	skills, err := h.queries.ListRoleSkills(r.Context(), role.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list role skills")
		return
	}
	out := make([]adminRoleSkillResponse, len(skills))
	for i, s := range skills {
		out[i] = adminRoleSkillResponse{ID: util.UUIDToString(s.ID), Name: s.Name, Description: s.Description}
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": out})
}

func (h *Handler) SetAgentRoleSkills(w http.ResponseWriter, r *http.Request) {
	role, ok := h.loadRole(w, r)
	if !ok {
		return
	}
	var req adminRoleSkillsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.SkillIDs) > maxRoleSkills {
		writeError(w, http.StatusBadRequest, "a role can carry at most 50 skills")
		return
	}

	skills := make([]db.Skill, 0, len(req.SkillIDs))
	seenID := make(map[string]struct{}, len(req.SkillIDs))
	seenName := make(map[string]struct{}, len(req.SkillIDs))
	for _, raw := range req.SkillIDs {
		id, err := util.ParseUUID(strings.TrimSpace(raw))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid skill id")
			return
		}
		key := util.UUIDToString(id)
		if _, ok := seenID[key]; ok {
			continue
		}
		skill, err := h.queries.GetSkill(r.Context(), id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusBadRequest, "skill not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to load skill")
			return
		}
		if skill.WorkspaceID.Valid {
			writeError(w, http.StatusBadRequest, "a role can only carry global skills")
			return
		}
		name := strings.ToLower(strings.TrimSpace(skill.Name))
		if _, ok := seenName[name]; ok {
			writeError(w, http.StatusBadRequest, "two skills in this role share the name "+skill.Name)
			return
		}
		seenID[key] = struct{}{}
		seenName[name] = struct{}{}
		skills = append(skills, skill)
	}

	ids := make([]pgtype.UUID, len(skills))
	for i, s := range skills {
		ids[i] = s.ID
	}
	// A role skill is mandatory for the agents bound to it; clear their
	// per-agent rows so a stale "disabled" binding cannot contradict it.
	if len(ids) > 0 {
		if err := h.queries.DeleteAgentSkillBindingsForRole(r.Context(), db.DeleteAgentSkillBindingsForRoleParams{
			RoleID:   role.ID,
			SkillIds: ids,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to clear per-agent bindings")
			return
		}
	}
	if err := h.queries.DeleteRoleSkillsByRole(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to replace role skills")
		return
	}
	for i, s := range skills {
		if err := h.queries.AddRoleSkill(r.Context(), db.AddRoleSkillParams{
			RoleID:   role.ID,
			SkillID:  s.ID,
			Position: int32(i),
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save role skills")
			return
		}
	}
	slog.Info("platform admin set role skills",
		"user_id", r.Header.Get("X-User-ID"),
		"role_id", util.UUIDToString(role.ID),
		"skill_count", len(skills),
	)
	out := make([]adminRoleSkillResponse, len(skills))
	for i, s := range skills {
		out[i] = adminRoleSkillResponse{ID: util.UUIDToString(s.ID), Name: s.Name, Description: s.Description}
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": out})
}

func (h *Handler) loadRole(w http.ResponseWriter, r *http.Request) (db.AgentRole, bool) {
	id, err := util.ParseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return db.AgentRole{}, false
	}
	role, err := h.queries.GetAgentRole(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "role not found")
			return db.AgentRole{}, false
		}
		writeError(w, http.StatusInternalServerError, "failed to load role")
		return db.AgentRole{}, false
	}
	return role, true
}

// isAdminUniqueViolation reports a INSERT/UPDATE that lost a unique constraint.
func isAdminUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
