package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminTaskResponse struct {
	ID             string  `json:"id"`
	AgentID        string  `json:"agent_id"`
	IssueID        string  `json:"issue_id"`
	RuntimeID      string  `json:"runtime_id"`
	Status         string  `json:"status"`
	CreatedAt      string  `json:"created_at"`
	StartedAt      *string `json:"started_at"`
	CompletedAt    *string `json:"completed_at"`
	FailureReason  *string `json:"failure_reason"`
	Error          *string `json:"error"`
	TriggerSummary *string `json:"trigger_summary"`
	Attempt        int32   `json:"attempt"`
	MaxAttempts    int32   `json:"max_attempts"`
	AgentName      string  `json:"agent_name"`
	WorkspaceID    string  `json:"workspace_id"`
	WorkspaceName  string  `json:"workspace_name"`
	WorkspaceSlug  string  `json:"workspace_slug"`
	IssueNumber    *int32  `json:"issue_number"`
	IssueTitle     *string `json:"issue_title"`
	RuntimeName    *string `json:"runtime_name"`
	InputTokens    int64   `json:"input_tokens"`
	OutputTokens   int64   `json:"output_tokens"`
	CostUsdTicks   int64   `json:"cost_usd_ticks"`
	CostUSD        float64 `json:"cost_usd"`
}

type adminTaskUsageResponse struct {
	Provider     string  `json:"provider"`
	Model        string  `json:"model"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
	CostUsdTicks int64   `json:"cost_usd_ticks"`
	CostUSD      float64 `json:"cost_usd"`
}

type adminTaskDetailResponse struct {
	adminTaskResponse
	WorkflowStep *string                  `json:"workflow_step"`
	BranchName   *string                  `json:"branch_name"`
	Usage        []adminTaskUsageResponse `json:"usage"`
}

func listTaskResponse(row db.ListAdminTasksRow) adminTaskResponse {
	return adminTaskResponse{
		ID:             uuidString(row.ID),
		AgentID:        uuidString(row.AgentID),
		IssueID:        uuidString(row.IssueID),
		RuntimeID:      uuidString(row.RuntimeID),
		Status:         row.Status,
		CreatedAt:      timestampString(row.CreatedAt),
		StartedAt:      timePtr(row.StartedAt),
		CompletedAt:    timePtr(row.CompletedAt),
		FailureReason:  textPtr(row.FailureReason),
		Error:          textPtr(row.Error),
		TriggerSummary: textPtr(row.TriggerSummary),
		Attempt:        row.Attempt,
		MaxAttempts:    row.MaxAttempts,
		AgentName:      row.AgentName,
		WorkspaceID:    uuidString(row.WorkspaceID),
		WorkspaceName:  row.WorkspaceName,
		WorkspaceSlug:  row.WorkspaceSlug,
		IssueNumber:    int4Ptr(row.IssueNumber),
		IssueTitle:     textPtr(row.IssueTitle),
		RuntimeName:    textPtr(row.RuntimeName),
		InputTokens:    row.InputTokens,
		OutputTokens:   row.OutputTokens,
		CostUsdTicks:   row.CostUsdTicks,
		CostUSD:        float64(row.CostUsdTicks) / 1e10,
	}
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	req := parsePageRequest(r, map[string]bool{
		"created_at":   true,
		"status":       true,
		"agent":        true,
		"workspace":    true,
		"started_at":   true,
		"completed_at": true,
	}, "created_at")
	filters := db.ListAdminTasksParams{
		Query:       queryValue(values, "q"),
		Status:      queryValue(values, "status"),
		WorkspaceID: nullableUUID(queryValue(values, "workspace_id")),
		AgentID:     nullableUUID(queryValue(values, "agent_id")),
		RuntimeID:   nullableUUID(queryValue(values, "runtime_id")),
		FromAt:      nullableTime(queryValue(values, "from")),
		ToAt:        nullableTime(queryValue(values, "to")),
		SortKey:     req.SortKey,
		SortDir:     req.SortDir,
		PageLimit:   req.PageSize,
		PageOffset:  req.Offset,
	}

	total, err := h.queries.CountAdminTasks(r.Context(), db.CountAdminTasksParams{
		Query:       filters.Query,
		Status:      filters.Status,
		WorkspaceID: filters.WorkspaceID,
		AgentID:     filters.AgentID,
		RuntimeID:   filters.RuntimeID,
		FromAt:      filters.FromAt,
		ToAt:        filters.ToAt,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count tasks")
		return
	}
	rows, err := h.queries.ListAdminTasks(r.Context(), filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}

	items := make([]adminTaskResponse, len(rows))
	for i, row := range rows {
		items[i] = listTaskResponse(row)
	}
	writeJSON(w, http.StatusOK, newPageResponse(items, total, req))
}

func (h *Handler) GetTask(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, chi.URLParam(r, "id"), "task id")
	if !ok {
		return
	}
	row, err := h.queries.GetAdminTask(r.Context(), id)
	if err != nil {
		writeDBError(w, err, "task not found", "failed to load task")
		return
	}
	usageRows, err := h.queries.GetTaskUsage(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load task usage")
		return
	}

	base := listTaskResponse(db.ListAdminTasksRow{
		ID:             row.ID,
		AgentID:        row.AgentID,
		IssueID:        row.IssueID,
		RuntimeID:      row.RuntimeID,
		Status:         row.Status,
		CreatedAt:      row.CreatedAt,
		StartedAt:      row.StartedAt,
		CompletedAt:    row.CompletedAt,
		FailureReason:  row.FailureReason,
		Error:          row.Error,
		TriggerSummary: row.TriggerSummary,
		Attempt:        row.Attempt,
		MaxAttempts:    row.MaxAttempts,
		AgentName:      row.AgentName,
		WorkspaceID:    row.WorkspaceID,
		WorkspaceName:  row.WorkspaceName,
		WorkspaceSlug:  row.WorkspaceSlug,
		IssueNumber:    row.IssueNumber,
		IssueTitle:     row.IssueTitle,
		RuntimeName:    row.RuntimeName,
		InputTokens:    row.InputTokens,
		OutputTokens:   row.OutputTokens,
		CostUsdTicks:   row.CostUsdTicks,
	})

	usage := make([]adminTaskUsageResponse, len(usageRows))
	for i, u := range usageRows {
		ticks := int64(0)
		if u.CostUsdTicks.Valid {
			ticks = u.CostUsdTicks.Int64
		}
		usage[i] = adminTaskUsageResponse{
			Provider:     u.Provider,
			Model:        u.Model,
			InputTokens:  u.InputTokens,
			OutputTokens: u.OutputTokens,
			CostUsdTicks: ticks,
			CostUSD:      float64(ticks) / 1e10,
		}
	}

	writeJSON(w, http.StatusOK, adminTaskDetailResponse{
		adminTaskResponse: base,
		WorkflowStep:      textPtr(row.WorkflowStep),
		BranchName:        textPtr(row.BranchName),
		Usage:             usage,
	})
}
