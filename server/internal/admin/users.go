package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminUserResponse struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Email          string  `json:"email"`
	AvatarURL      *string `json:"avatar_url"`
	CreatedAt      string  `json:"created_at"`
	OnboardedAt    *string `json:"onboarded_at"`
	WorkspaceCount int64   `json:"workspace_count"`
}

type adminMembershipResponse struct {
	ID            string `json:"id"`
	WorkspaceID   string `json:"workspace_id"`
	WorkspaceName string `json:"workspace_name"`
	WorkspaceSlug string `json:"workspace_slug"`
	Role          string `json:"role"`
	CreatedAt     string `json:"created_at"`
}

type adminUserDetailResponse struct {
	adminUserResponse
	Memberships []adminMembershipResponse `json:"memberships"`
}

func userResponse(row db.GetAdminUserRow) adminUserResponse {
	return adminUserResponse{
		ID:             uuidString(row.ID),
		Name:           row.Name,
		Email:          row.Email,
		AvatarURL:      textPtr(row.AvatarUrl),
		CreatedAt:      timestampString(row.CreatedAt),
		OnboardedAt:    timePtr(row.OnboardedAt),
		WorkspaceCount: row.WorkspaceCount,
	}
}

func listUserResponse(row db.ListAdminUsersRow) adminUserResponse {
	return adminUserResponse{
		ID:             uuidString(row.ID),
		Name:           row.Name,
		Email:          row.Email,
		AvatarURL:      textPtr(row.AvatarUrl),
		CreatedAt:      timestampString(row.CreatedAt),
		OnboardedAt:    timePtr(row.OnboardedAt),
		WorkspaceCount: row.WorkspaceCount,
	}
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	req := parsePageRequest(r, map[string]bool{
		"created_at": true,
		"name":       true,
		"email":      true,
		"workspaces": true,
	}, "created_at")
	query := queryValue(values, "q")

	total, err := h.queries.CountAdminUsers(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count users")
		return
	}
	rows, err := h.queries.ListAdminUsers(r.Context(), db.ListAdminUsersParams{
		Query:      query,
		SortKey:    req.SortKey,
		SortDir:    req.SortDir,
		PageLimit:  req.PageSize,
		PageOffset: req.Offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}

	items := make([]adminUserResponse, len(rows))
	for i, row := range rows {
		items[i] = listUserResponse(row)
	}
	writeJSON(w, http.StatusOK, newPageResponse(items, total, req))
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "user id")
	if !ok {
		return
	}
	row, err := h.queries.GetAdminUser(r.Context(), id)
	if err != nil {
		writeDBError(w, err, "user not found", "failed to load user")
		return
	}
	memberships, err := h.queries.ListAdminUserMemberships(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load user memberships")
		return
	}
	resp := adminUserDetailResponse{
		adminUserResponse: userResponse(row),
		Memberships:       make([]adminMembershipResponse, len(memberships)),
	}
	for i, membership := range memberships {
		resp.Memberships[i] = adminMembershipResponse{
			ID:            uuidString(membership.ID),
			WorkspaceID:   uuidString(membership.WorkspaceID),
			WorkspaceName: membership.WorkspaceName,
			WorkspaceSlug: membership.WorkspaceSlug,
			Role:          membership.Role,
			CreatedAt:     timestampString(membership.CreatedAt),
		}
	}
	writeJSON(w, http.StatusOK, resp)
}
