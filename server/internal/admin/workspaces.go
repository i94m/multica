package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminWorkspaceResponse struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	AvatarURL    *string `json:"avatar_url"`
	CreatedAt    string  `json:"created_at"`
	MemberCount  int64   `json:"member_count"`
	IssueCount   int64   `json:"issue_count"`
	AgentCount   int64   `json:"agent_count"`
	RuntimeCount int64   `json:"runtime_count"`
}

type adminWorkspaceOwnerResponse struct {
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
}

type adminWorkspaceDetailResponse struct {
	adminWorkspaceResponse
	Owners []adminWorkspaceOwnerResponse `json:"owners"`
}

func workspaceResponse(row db.GetAdminWorkspaceRow) adminWorkspaceResponse {
	return adminWorkspaceResponse{
		ID:           uuidString(row.ID),
		Name:         row.Name,
		Slug:         row.Slug,
		AvatarURL:    textPtr(row.AvatarUrl),
		CreatedAt:    timestampString(row.CreatedAt),
		MemberCount:  row.MemberCount,
		IssueCount:   row.IssueCount,
		AgentCount:   row.AgentCount,
		RuntimeCount: row.RuntimeCount,
	}
}

func listWorkspaceResponse(row db.ListAdminWorkspacesRow) adminWorkspaceResponse {
	return adminWorkspaceResponse{
		ID:           uuidString(row.ID),
		Name:         row.Name,
		Slug:         row.Slug,
		AvatarURL:    textPtr(row.AvatarUrl),
		CreatedAt:    timestampString(row.CreatedAt),
		MemberCount:  row.MemberCount,
		IssueCount:   row.IssueCount,
		AgentCount:   row.AgentCount,
		RuntimeCount: row.RuntimeCount,
	}
}

func (h *Handler) ListWorkspaces(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	cursorAt, cursorID, ok := decodeCursor(queryValue(values, "cursor"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid cursor")
		return
	}
	limit := parseLimit(queryValue(values, "limit"))

	rows, err := h.queries.ListAdminWorkspaces(r.Context(), db.ListAdminWorkspacesParams{
		Query:           queryValue(values, "q"),
		CursorCreatedAt: cursorAt,
		CursorID:        cursorID,
		PageLimit:       limit + 1,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list workspaces")
		return
	}

	items := make([]adminWorkspaceResponse, len(rows))
	for i, row := range rows {
		items[i] = listWorkspaceResponse(row)
	}
	writeJSON(w, http.StatusOK, pageFrom(items, limit, func(item adminWorkspaceResponse) (pgtype.Timestamptz, pgtype.UUID) {
		return cursorFromStrings(item.CreatedAt, item.ID)
	}))
}

func (h *Handler) GetWorkspace(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "workspace id")
	if !ok {
		return
	}
	row, err := h.queries.GetAdminWorkspace(r.Context(), id)
	if err != nil {
		writeDBError(w, err, "workspace not found", "failed to load workspace")
		return
	}
	owners, err := h.queries.ListAdminWorkspaceOwners(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load workspace owners")
		return
	}
	resp := adminWorkspaceDetailResponse{
		adminWorkspaceResponse: workspaceResponse(row),
		Owners:                 make([]adminWorkspaceOwnerResponse, len(owners)),
	}
	for i, owner := range owners {
		resp.Owners[i] = adminWorkspaceOwnerResponse{
			UserID:    uuidString(owner.UserID),
			Name:      owner.Name,
			Email:     owner.Email,
			CreatedAt: timestampString(owner.CreatedAt),
		}
	}
	writeJSON(w, http.StatusOK, resp)
}
