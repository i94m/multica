package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
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

type adminWorkspaceMemberResponse struct {
	ID        string  `json:"id"`
	UserID    string  `json:"user_id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	AvatarURL *string `json:"avatar_url"`
	Role      string  `json:"role"`
	CreatedAt string  `json:"created_at"`
}

type adminWorkspaceDetailResponse struct {
	adminWorkspaceResponse
	Members []adminWorkspaceMemberResponse `json:"members"`
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
	req := parsePageRequest(r, map[string]bool{
		"created_at": true,
		"name":       true,
		"members":    true,
		"issues":     true,
		"agents":     true,
		"runtimes":   true,
	}, "created_at")
	query := queryValue(values, "q")

	total, err := h.queries.CountAdminWorkspaces(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count workspaces")
		return
	}
	rows, err := h.queries.ListAdminWorkspaces(r.Context(), db.ListAdminWorkspacesParams{
		Query:      query,
		SortKey:    req.SortKey,
		SortDir:    req.SortDir,
		PageLimit:  req.PageSize,
		PageOffset: req.Offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list workspaces")
		return
	}

	items := make([]adminWorkspaceResponse, len(rows))
	for i, row := range rows {
		items[i] = listWorkspaceResponse(row)
	}
	writeJSON(w, http.StatusOK, newPageResponse(items, total, req))
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
	members, err := h.queries.ListMembersWithUser(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load workspace members")
		return
	}
	resp := adminWorkspaceDetailResponse{
		adminWorkspaceResponse: workspaceResponse(row),
		Members:                make([]adminWorkspaceMemberResponse, len(members)),
	}
	for i, member := range members {
		resp.Members[i] = adminWorkspaceMemberResponse{
			ID:        uuidString(member.ID),
			UserID:    uuidString(member.UserID),
			Name:      member.UserName,
			Email:     member.UserEmail,
			AvatarURL: textPtr(member.UserAvatarUrl),
			Role:      member.Role,
			CreatedAt: timestampString(member.CreatedAt),
		}
	}
	writeJSON(w, http.StatusOK, resp)
}
