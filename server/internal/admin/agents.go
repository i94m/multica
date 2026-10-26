package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminAgentResponse struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	WorkspaceID    string  `json:"workspace_id"`
	WorkspaceName  string  `json:"workspace_name"`
	WorkspaceSlug  string  `json:"workspace_slug"`
	Status         string  `json:"status"`
	Kind           string  `json:"kind"`
	PermissionMode string  `json:"permission_mode"`
	OwnerID        string  `json:"owner_id"`
	OwnerName      *string `json:"owner_name"`
	OwnerEmail     *string `json:"owner_email"`
	RuntimeID      string  `json:"runtime_id"`
	RuntimeName    *string `json:"runtime_name"`
	CreatedAt      string  `json:"created_at"`
	ArchivedAt     *string `json:"archived_at"`
	Runs30d        int64   `json:"runs_30d"`
}

type adminAgentDetailResponse struct {
	adminAgentResponse
	Description string  `json:"description"`
	Model       *string `json:"model"`
	UpdatedAt   string  `json:"updated_at"`
}

func listAgentResponse(row db.ListAdminAgentsRow) adminAgentResponse {
	return adminAgentResponse{
		ID:             uuidString(row.ID),
		Name:           row.Name,
		WorkspaceID:    uuidString(row.WorkspaceID),
		WorkspaceName:  row.WorkspaceName,
		WorkspaceSlug:  row.WorkspaceSlug,
		Status:         row.Status,
		Kind:           row.Kind,
		PermissionMode: row.PermissionMode,
		OwnerID:        uuidString(row.OwnerID),
		OwnerName:      textPtr(row.OwnerName),
		OwnerEmail:     textPtr(row.OwnerEmail),
		RuntimeID:      uuidString(row.RuntimeID),
		RuntimeName:    textPtr(row.RuntimeName),
		CreatedAt:      timestampString(row.CreatedAt),
		ArchivedAt:     timePtr(row.ArchivedAt),
		Runs30d:        row.Runs30d,
	}
}

func (h *Handler) ListAgents(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	req := parsePageRequest(r, map[string]bool{
		"created_at":  true,
		"name":        true,
		"runs":        true,
		"archived_at": true,
	}, "created_at")
	filters := db.ListAdminAgentsParams{
		Query:           queryValue(values, "q"),
		WorkspaceID:     nullableUUID(queryValue(values, "workspace_id")),
		IncludeArchived: queryValue(values, "include_archived") == "true",
		Kind:            queryValue(values, "kind"),
		PermissionMode:  queryValue(values, "permission_mode"),
		SortKey:         req.SortKey,
		SortDir:         req.SortDir,
		PageLimit:       req.PageSize,
		PageOffset:      req.Offset,
	}

	total, err := h.queries.CountAdminAgents(r.Context(), db.CountAdminAgentsParams{
		Query:           filters.Query,
		WorkspaceID:     filters.WorkspaceID,
		IncludeArchived: filters.IncludeArchived,
		Kind:            filters.Kind,
		PermissionMode:  filters.PermissionMode,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count agents")
		return
	}
	rows, err := h.queries.ListAdminAgents(r.Context(), filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list agents")
		return
	}

	items := make([]adminAgentResponse, len(rows))
	for i, row := range rows {
		items[i] = listAgentResponse(row)
	}
	writeJSON(w, http.StatusOK, newPageResponse(items, total, req))
}

func (h *Handler) GetAgent(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "agent id")
	if !ok {
		return
	}
	row, err := h.queries.GetAdminAgent(r.Context(), id)
	if err != nil {
		writeDBError(w, err, "agent not found", "failed to load agent")
		return
	}
	base := adminAgentResponse{
		ID:             uuidString(row.ID),
		Name:           row.Name,
		WorkspaceID:    uuidString(row.WorkspaceID),
		WorkspaceName:  row.WorkspaceName,
		WorkspaceSlug:  row.WorkspaceSlug,
		Status:         row.Status,
		Kind:           row.Kind,
		PermissionMode: row.PermissionMode,
		OwnerID:        uuidString(row.OwnerID),
		OwnerName:      textPtr(row.OwnerName),
		OwnerEmail:     textPtr(row.OwnerEmail),
		RuntimeID:      uuidString(row.RuntimeID),
		RuntimeName:    textPtr(row.RuntimeName),
		CreatedAt:      timestampString(row.CreatedAt),
		ArchivedAt:     timePtr(row.ArchivedAt),
		Runs30d:        row.Runs30d,
	}
	writeJSON(w, http.StatusOK, adminAgentDetailResponse{
		adminAgentResponse: base,
		Description:        row.Description,
		Model:              textPtr(row.Model),
		UpdatedAt:          timestampString(row.UpdatedAt),
	})
}
