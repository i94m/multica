package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// SetSkillScopeRequest moves a skill between workspace ownership and the
// global namespace. Global skills have no owning workspace and are visible to
// every workspace.
type SetSkillScopeRequest struct {
	Scope string `json:"scope"`
}

const (
	skillScopeWorkspace = "workspace"
	skillScopeGlobal    = "global"
)

// SetSkillScope implements PUT /api/skills/{id}/scope.
//
// Promotion is admin-only: it makes the skill available to every workspace and
// only workspace owners/admins may do that. Demotion moves the skill into the
// workspace the request is scoped to; the creator keeps the same ability they
// have on any workspace skill.
func (h *Handler) SetSkillScope(w http.ResponseWriter, r *http.Request) {
	skill, ok := h.loadSkillForUser(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var req SetSkillScopeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	switch req.Scope {
	case skillScopeGlobal:
		h.promoteSkillToGlobal(w, r, skill)
	case skillScopeWorkspace:
		h.moveSkillToWorkspace(w, r, skill)
	default:
		writeError(w, http.StatusBadRequest, `scope must be "workspace" or "global"`)
	}
}

func (h *Handler) promoteSkillToGlobal(w http.ResponseWriter, r *http.Request, skill db.Skill) {
	if !skill.WorkspaceID.Valid {
		writeError(w, http.StatusConflict, "skill is already global")
		return
	}
	// A plugin installation owns the skill lifecycle: uninstall removes the
	// skills it contributed. Promoting one would escape that cleanup.
	if skill.PluginInstallationID.Valid {
		writeError(w, http.StatusConflict, "plugin-provided skills cannot be made global")
		return
	}
	if _, ok := h.requireSkillAdmin(w, r, uuidToString(skill.WorkspaceID)); !ok {
		return
	}

	updated, err := h.Queries.PromoteSkillToGlobal(r.Context(), db.PromoteSkillToGlobalParams{
		ID:          skill.ID,
		WorkspaceID: skill.WorkspaceID,
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			writeError(w, http.StatusConflict, "skill is no longer in this workspace")
		case isUniqueViolation(err):
			writeError(w, http.StatusConflict, "a global skill with this name already exists")
		default:
			slog.Warn("promote skill to global failed", append(logger.RequestAttrs(r), "error", err)...)
			writeError(w, http.StatusInternalServerError, "failed to make skill global")
		}
		return
	}

	resp := skillToResponse(updated)
	h.publishSkillUpdated(r, updated, resp)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) moveSkillToWorkspace(w http.ResponseWriter, r *http.Request, skill db.Skill) {
	if skill.WorkspaceID.Valid {
		writeError(w, http.StatusConflict, "skill already belongs to a workspace")
		return
	}

	workspaceID := h.resolveWorkspaceID(r)
	if _, ok := h.requireSkillAdmin(w, r, workspaceID); !ok {
		return
	}
	workspaceUUID, ok := parseUUIDOrBadRequest(w, workspaceID, "workspace_id")
	if !ok {
		return
	}

	updated, err := h.Queries.MoveSkillToWorkspace(r.Context(), db.MoveSkillToWorkspaceParams{
		ID:          skill.ID,
		WorkspaceID: workspaceUUID,
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			writeError(w, http.StatusConflict, "skill is no longer global")
		case isUniqueViolation(err):
			writeError(w, http.StatusConflict, "a skill with this name already exists in this workspace")
		default:
			slog.Warn("move global skill to workspace failed", append(logger.RequestAttrs(r), "error", err)...)
			writeError(w, http.StatusInternalServerError, "failed to move skill to workspace")
		}
		return
	}

	resp := skillToResponse(updated)
	h.publishSkillUpdated(r, updated, resp)
	writeJSON(w, http.StatusOK, resp)
}

// publishSkillUpdated routes a skill:* event. Workspace skills stay in their
// workspace room; global skills publish with an empty workspace so the
// realtime listener can broadcast them to every workspace.
func (h *Handler) publishSkillUpdated(r *http.Request, skill db.Skill, resp SkillResponse) {
	actorType, actorID := h.resolveActor(r, requestUserID(r), h.resolveWorkspaceID(r))
	h.publish(protocol.EventSkillUpdated, uuidToString(skill.WorkspaceID), actorType, actorID, map[string]any{"skill": resp})
}
