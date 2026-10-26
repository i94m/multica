package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminRuntimeResponse struct {
	ID            string  `json:"id"`
	WorkspaceID   string  `json:"workspace_id"`
	WorkspaceName string  `json:"workspace_name"`
	WorkspaceSlug string  `json:"workspace_slug"`
	DisplayName   string  `json:"display_name"`
	Provider      string  `json:"provider"`
	Status        string  `json:"status"`
	LastSeenAt    *string `json:"last_seen_at"`
	CreatedAt     string  `json:"created_at"`
	OwnerID       string  `json:"owner_id"`
	OwnerName     *string `json:"owner_name"`
	OwnerEmail    *string `json:"owner_email"`
	Visibility    string  `json:"visibility"`
	DeviceInfo    string  `json:"device_info"`
}

type adminRuntimeDetailResponse struct {
	adminRuntimeResponse
	TaskCount       int64 `json:"task_count"`
	ActiveTaskCount int64 `json:"active_task_count"`
}

func listRuntimeResponse(row db.ListAdminRuntimesRow) adminRuntimeResponse {
	return adminRuntimeResponse{
		ID:            uuidString(row.ID),
		WorkspaceID:   uuidString(row.WorkspaceID),
		WorkspaceName: row.WorkspaceName,
		WorkspaceSlug: row.WorkspaceSlug,
		DisplayName:   row.DisplayName,
		Provider:      row.Provider,
		Status:        row.Status,
		LastSeenAt:    timePtr(row.LastSeenAt),
		CreatedAt:     timestampString(row.CreatedAt),
		OwnerID:       uuidString(row.OwnerID),
		OwnerName:     textPtr(row.OwnerName),
		OwnerEmail:    textPtr(row.OwnerEmail),
		Visibility:    row.Visibility,
		DeviceInfo:    truncate(row.DeviceInfo, 240),
	}
}

func (h *Handler) ListRuntimes(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	cursorAt, cursorID, ok := decodeCursor(queryValue(values, "cursor"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid cursor")
		return
	}
	limit := parseLimit(queryValue(values, "limit"))
	rows, err := h.queries.ListAdminRuntimes(r.Context(), db.ListAdminRuntimesParams{
		Query:           queryValue(values, "q"),
		WorkspaceID:     nullableUUID(queryValue(values, "workspace_id")),
		Status:          queryValue(values, "status"),
		CursorCreatedAt: cursorAt,
		CursorID:        cursorID,
		PageLimit:       limit + 1,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runtimes")
		return
	}

	items := make([]adminRuntimeResponse, len(rows))
	for i, row := range rows {
		items[i] = listRuntimeResponse(row)
	}
	writeJSON(w, http.StatusOK, pageFrom(items, limit, func(item adminRuntimeResponse) (pgtype.Timestamptz, pgtype.UUID) {
		return cursorFromStrings(item.CreatedAt, item.ID)
	}))
}

func (h *Handler) GetRuntime(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "runtime id")
	if !ok {
		return
	}
	row, err := h.queries.GetAdminRuntime(r.Context(), id)
	if err != nil {
		writeDBError(w, err, "runtime not found", "failed to load runtime")
		return
	}
	writeJSON(w, http.StatusOK, adminRuntimeDetailResponse{
		adminRuntimeResponse: adminRuntimeResponse{
			ID:            uuidString(row.ID),
			WorkspaceID:   uuidString(row.WorkspaceID),
			WorkspaceName: row.WorkspaceName,
			WorkspaceSlug: row.WorkspaceSlug,
			DisplayName:   row.DisplayName,
			Provider:      row.Provider,
			Status:        row.Status,
			LastSeenAt:    timePtr(row.LastSeenAt),
			CreatedAt:     timestampString(row.CreatedAt),
			OwnerID:       uuidString(row.OwnerID),
			OwnerName:     textPtr(row.OwnerName),
			OwnerEmail:    textPtr(row.OwnerEmail),
			Visibility:    row.Visibility,
			DeviceInfo:    truncate(row.DeviceInfo, 1000),
		},
		TaskCount:       row.TaskCount,
		ActiveTaskCount: row.ActiveTaskCount,
	})
}
