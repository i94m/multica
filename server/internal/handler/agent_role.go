package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const (
	agentRoleNameMaxLength        = 120
	agentRoleDescriptionMaxLength = 255
	agentRoleInstructionsMax      = 100_000
)

// AgentRoleResponse is the wire shape shared by the role library and the agent
// detail surfaces. Global roles carry an empty workspace_id and scope=global.
type AgentRoleResponse struct {
	ID           string  `json:"id"`
	WorkspaceID  string  `json:"workspace_id"`
	Scope        string  `json:"scope"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Instructions string  `json:"instructions"`
	CreatedBy    *string `json:"created_by"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
	IsDefault    bool    `json:"is_default"`
	AgentCount   int64   `json:"agent_count"`
}

type createAgentRoleRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	Instructions string `json:"instructions"`
	// Scope is "workspace" (default) or "global". Only workspace owners and
	// admins may create or change a global role.
	Scope string `json:"scope"`
}

type updateAgentRoleRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	Instructions string `json:"instructions"`
}

type setDefaultAgentRoleRequest struct {
	RoleID string `json:"role_id"`
}

func agentRoleScope(workspaceID pgtype.UUID) string {
	if workspaceID.Valid {
		return "workspace"
	}
	return "global"
}

func agentRoleToResponse(role db.AgentRole, isDefault bool, agentCount int64) AgentRoleResponse {
	return AgentRoleResponse{
		ID:           uuidToString(role.ID),
		WorkspaceID:  uuidToString(role.WorkspaceID),
		Scope:        agentRoleScope(role.WorkspaceID),
		Name:         role.Name,
		Description:  role.Description,
		Instructions: role.Instructions,
		CreatedBy:    uuidToPtr(role.CreatedBy),
		CreatedAt:    timestampToString(role.CreatedAt),
		UpdatedAt:    timestampToString(role.UpdatedAt),
		IsDefault:    isDefault,
		AgentCount:   agentCount,
	}
}

func listAgentRoleToResponse(role db.ListAgentRolesRow) AgentRoleResponse {
	return AgentRoleResponse{
		ID:           uuidToString(role.ID),
		WorkspaceID:  uuidToString(role.WorkspaceID),
		Scope:        agentRoleScope(role.WorkspaceID),
		Name:         role.Name,
		Description:  role.Description,
		Instructions: role.Instructions,
		CreatedBy:    uuidToPtr(role.CreatedBy),
		CreatedAt:    timestampToString(role.CreatedAt),
		UpdatedAt:    timestampToString(role.UpdatedAt),
		IsDefault:    role.IsDefault,
		AgentCount:   role.AgentCount,
	}
}

func normaliseAgentRoleInput(name, description, instructions string) (string, string, string, string) {
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	instructions = strings.TrimSpace(instructions)
	if name == "" {
		return "", "", "", "name is required"
	}
	if utf8.RuneCountInString(name) > agentRoleNameMaxLength {
		return "", "", "", "name is too long"
	}
	if utf8.RuneCountInString(description) > agentRoleDescriptionMaxLength {
		return "", "", "", "description is too long"
	}
	if utf8.RuneCountInString(instructions) > agentRoleInstructionsMax {
		return "", "", "", "instructions are too long"
	}
	return name, description, instructions, ""
}

// roleVisibleInWorkspace enforces the tenant boundary: a workspace role is
// only addressable from its own workspace, while a global role is visible
// everywhere.
func roleVisibleInWorkspace(role db.AgentRole, workspaceID string) bool {
	if !role.WorkspaceID.Valid {
		return true
	}
	return uuidToString(role.WorkspaceID) == workspaceID
}

func (h *Handler) roleAdmin(w http.ResponseWriter, r *http.Request, workspaceID string) bool {
	_, ok := h.requireWorkspaceRole(w, r, workspaceID, "role not found", "owner", "admin")
	return ok
}

func (h *Handler) loadRoleVisible(w http.ResponseWriter, r *http.Request, workspaceID string) (db.AgentRole, bool) {
	roleID, ok := parseUUIDOrBadRequest(w, chi.URLParam(r, "id"), "role id")
	if !ok {
		return db.AgentRole{}, false
	}
	role, err := h.Queries.GetAgentRole(r.Context(), roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "role not found")
			return db.AgentRole{}, false
		}
		writeError(w, http.StatusInternalServerError, "failed to load role")
		return db.AgentRole{}, false
	}
	if !roleVisibleInWorkspace(role, workspaceID) {
		writeError(w, http.StatusNotFound, "role not found")
		return db.AgentRole{}, false
	}
	return role, true
}

// ListAgentRoles returns the workspace's roles plus every global role.
func (h *Handler) ListAgentRoles(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	wsUUID, ok := parseUUIDOrBadRequest(w, workspaceID, "workspace id")
	if !ok {
		return
	}
	rows, err := h.Queries.ListAgentRoles(r.Context(), wsUUID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list roles")
		return
	}
	roles := make([]AgentRoleResponse, 0, len(rows))
	for _, row := range rows {
		roles = append(roles, listAgentRoleToResponse(row))
	}
	writeJSON(w, http.StatusOK, roles)
}

// CreateAgentRole creates a workspace role, or a global role when scope is
// "global". Both require workspace owner/admin.
func (h *Handler) CreateAgentRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if !h.roleAdmin(w, r, workspaceID) {
		return
	}
	var req createAgentRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, description, instructions, msg := normaliseAgentRoleInput(req.Name, req.Description, req.Instructions)
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	scope := strings.TrimSpace(req.Scope)
	if scope == "" {
		scope = "workspace"
	}
	if scope != "workspace" && scope != "global" {
		writeError(w, http.StatusBadRequest, `scope must be "workspace" or "global"`)
		return
	}
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	userUUID, ok := parseUUIDOrBadRequest(w, userID, "user id")
	if !ok {
		return
	}
	wsUUID, ok := parseUUIDOrBadRequest(w, workspaceID, "workspace id")
	if !ok {
		return
	}
	params := db.CreateAgentRoleParams{
		Name:         name,
		Description:  description,
		Instructions: instructions,
		CreatedBy:    userUUID,
	}
	if scope == "workspace" {
		params.WorkspaceID = wsUUID
	}
	role, err := h.Queries.CreateAgentRole(r.Context(), params)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a role with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create role")
		return
	}
	writeJSON(w, http.StatusCreated, agentRoleToResponse(role, false, 0))
}

// UpdateAgentRole edits the shared prompt. Agents keep their role_id, so the
// next run of every linked agent picks up the new text.
func (h *Handler) UpdateAgentRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if !h.roleAdmin(w, r, workspaceID) {
		return
	}
	role, ok := h.loadRoleVisible(w, r, workspaceID)
	if !ok {
		return
	}
	var req updateAgentRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, description, instructions, msg := normaliseAgentRoleInput(req.Name, req.Description, req.Instructions)
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	updated, err := h.Queries.UpdateAgentRole(r.Context(), db.UpdateAgentRoleParams{
		ID:           role.ID,
		Name:         name,
		Description:  description,
		Instructions: instructions,
	})
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a role with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	isDefault, count := h.roleDefaultAndCount(r.Context(), role.ID, workspaceID)
	writeJSON(w, http.StatusOK, agentRoleToResponse(updated, isDefault, count))
}

// DeleteAgentRole detaches the role from every agent and clears it as a
// workspace default before removing the row. Agents themselves are untouched.
func (h *Handler) DeleteAgentRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if !h.roleAdmin(w, r, workspaceID) {
		return
	}
	role, ok := h.loadRoleVisible(w, r, workspaceID)
	if !ok {
		return
	}
	tx, err := h.TxStarter.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())
	qtx := h.Queries.WithTx(tx)
	if err := qtx.ClearAgentRoleReferences(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to detach role from agents")
		return
	}
	if err := qtx.ClearWorkspaceDefaultAgentRoleReferences(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear default role")
		return
	}
	if err := qtx.DeleteAgentRole(r.Context(), role.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete role")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit role deletion")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SetDefaultAgentRole sets or clears the role every user agent in the
// workspace inherits automatically.
func (h *Handler) SetDefaultAgentRole(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	if !h.roleAdmin(w, r, workspaceID) {
		return
	}
	var req setDefaultAgentRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	wsUUID, ok := parseUUIDOrBadRequest(w, workspaceID, "workspace id")
	if !ok {
		return
	}
	if strings.TrimSpace(req.RoleID) == "" {
		if err := h.Queries.ClearWorkspaceDefaultAgentRole(r.Context(), wsUUID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to clear default role")
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	roleUUID, ok := parseUUIDOrBadRequest(w, req.RoleID, "role_id")
	if !ok {
		return
	}
	role, err := h.Queries.GetAgentRoleVisibleInWorkspace(r.Context(), db.GetAgentRoleVisibleInWorkspaceParams{
		ID:          roleUUID,
		WorkspaceID: wsUUID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "role not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load role")
		return
	}
	if !roleVisibleInWorkspace(role, workspaceID) {
		writeError(w, http.StatusNotFound, "role not found")
		return
	}
	if err := h.Queries.SetWorkspaceDefaultAgentRole(r.Context(), db.SetWorkspaceDefaultAgentRoleParams{
		RoleID:      role.ID,
		WorkspaceID: wsUUID,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set default role")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) roleDefaultAndCount(ctx context.Context, roleID pgtype.UUID, workspaceID string) (bool, int64) {
	wsUUID, err := util.ParseUUID(workspaceID)
	if err != nil {
		return false, 0
	}
	defaultID, err := h.Queries.GetWorkspaceDefaultAgentRoleID(ctx, wsUUID)
	count, countErr := h.Queries.CountAgentsUsingRole(ctx, roleID)
	if countErr != nil {
		slog.Warn("role: count agents failed", "role_id", uuidToString(roleID), "error", countErr)
	}
	return err == nil && defaultID.Valid && defaultID == roleID, count
}
