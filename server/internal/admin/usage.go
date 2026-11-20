package admin

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// minIssuesForUsage drops personal workspaces from the cross-workspace usage
// report. They hold a handful of issues, so a busy individual would otherwise
// outweigh a real team in the token and task totals.
const minIssuesForUsage = 5

// defaultUsageDays keeps the report to the current week unless the caller asks
// for an explicit range.
const defaultUsageDays = 7

// usageRowLimit caps a ranking, not a page: the console sorts and pages rows in
// the browser so switching columns does not refetch.
const usageRowLimit = 500

// usageDimensions whitelists the ranking switch; anything else falls back to
// the workspace view.
var usageDimensions = map[string]bool{
	"workspace": true,
	"agent":     true,
	"model":     true,
	"project":   true,
	"runtime":   true,
	"provider":  true,
}

type usageFilter struct {
	from        time.Time
	to          time.Time
	groupBy     string
	workspaceID pgtype.UUID
	provider    string
	model       string
}

type adminUsageTotalsResponse struct {
	InputTokens      int64   `json:"input_tokens"`
	OutputTokens     int64   `json:"output_tokens"`
	CacheReadTokens  int64   `json:"cache_read_tokens"`
	CacheWriteTokens int64   `json:"cache_write_tokens"`
	CostUsdTicks     int64   `json:"cost_usd_ticks"`
	CostUSD          float64 `json:"cost_usd"`
	TaskCount        int64   `json:"task_count"`
	ActiveWorkspaces int64   `json:"active_workspaces"`
	ActiveAgents     int64   `json:"active_agents"`
}

type adminUsageRow struct {
	ID               string  `json:"id,omitempty"`
	Name             string  `json:"name,omitempty"`
	WorkspaceID      string  `json:"workspace_id,omitempty"`
	WorkspaceName    string  `json:"workspace_name,omitempty"`
	WorkspaceSlug    string  `json:"workspace_slug,omitempty"`
	Provider         string  `json:"provider,omitempty"`
	Model            string  `json:"model,omitempty"`
	InputTokens      int64   `json:"input_tokens"`
	OutputTokens     int64   `json:"output_tokens"`
	CacheReadTokens  int64   `json:"cache_read_tokens"`
	CacheWriteTokens int64   `json:"cache_write_tokens"`
	CostUsdTicks     int64   `json:"cost_usd_ticks"`
	CostUSD          float64 `json:"cost_usd"`
	TaskCount        int64   `json:"task_count"`
	AgentCount       int64   `json:"agent_count"`
	DurationSeconds  int64   `json:"duration_seconds"`
	IssueCount       int64   `json:"issue_count"`
	LastActiveAt     string  `json:"last_active_at,omitempty"`
}

type adminUsageResponse struct {
	GroupBy string                   `json:"group_by"`
	From    string                   `json:"from"`
	To      string                   `json:"to"`
	Totals  adminUsageTotalsResponse `json:"totals"`
	Rows    []adminUsageRow          `json:"rows"`
}

type adminUsageTrendPoint struct {
	BucketStart     string `json:"bucket_start"`
	WorkspaceID     string `json:"workspace_id"`
	WorkspaceName   string `json:"workspace_name"`
	InputTokens     int64  `json:"input_tokens"`
	OutputTokens    int64  `json:"output_tokens"`
	CacheReadTokens int64  `json:"cache_read_tokens"`
	TaskCount       int64  `json:"task_count"`
}

type adminUsageTrendResponse struct {
	Bucket string                 `json:"bucket"`
	From   string                 `json:"from"`
	To     string                 `json:"to"`
	Points []adminUsageTrendPoint `json:"points"`
}

type adminUsageMatrixCell struct {
	WorkspaceID     string `json:"workspace_id"`
	WorkspaceName   string `json:"workspace_name"`
	Provider        string `json:"provider"`
	Model           string `json:"model"`
	InputTokens     int64  `json:"input_tokens"`
	OutputTokens    int64  `json:"output_tokens"`
	CacheReadTokens int64  `json:"cache_read_tokens"`
	TaskCount       int64  `json:"task_count"`
}

type adminUsageMatrixResponse struct {
	From  string                 `json:"from"`
	To    string                 `json:"to"`
	Cells []adminUsageMatrixCell `json:"cells"`
}

func usageRange(r *http.Request, now time.Time) (from, to time.Time) {
	values := r.URL.Query()
	from = timeParamOrDefault(queryValue(values, "from"), now.AddDate(0, 0, -defaultUsageDays))
	to = timeParamOrDefault(queryValue(values, "to"), now)
	return from, to
}

func parseUsageFilter(r *http.Request, now time.Time) usageFilter {
	values := r.URL.Query()
	from, to := usageRange(r, now)
	groupBy := queryValue(values, "group_by")
	if !usageDimensions[groupBy] {
		groupBy = "workspace"
	}
	return usageFilter{
		from:        from,
		to:          to,
		groupBy:     groupBy,
		workspaceID: nullableUUID(queryValue(values, "workspace_id")),
		provider:    queryValue(values, "provider"),
		model:       queryValue(values, "model"),
	}
}

func timestamp(z time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: z, Valid: true}
}

func usageTotalsResponse(row db.AdminUsageTotalsRow) adminUsageTotalsResponse {
	return adminUsageTotalsResponse{
		InputTokens:      row.InputTokens,
		OutputTokens:     row.OutputTokens,
		CacheReadTokens:  row.CacheReadTokens,
		CacheWriteTokens: row.CacheWriteTokens,
		CostUsdTicks:     row.CostUsdTicks,
		CostUSD:          float64(row.CostUsdTicks) / 1e10,
		TaskCount:        row.TaskCount,
		ActiveWorkspaces: row.ActiveWorkspaces,
		ActiveAgents:     row.ActiveAgents,
	}
}

func (h *Handler) Usage(w http.ResponseWriter, r *http.Request) {
	filter := parseUsageFilter(r, time.Now().UTC())

	totals, err := h.queries.AdminUsageTotals(r.Context(), db.AdminUsageTotalsParams{
		FromAt:      timestamp(filter.from),
		ToAt:        timestamp(filter.to),
		MinIssues:   minIssuesForUsage,
		WorkspaceID: filter.workspaceID,
		Provider:    filter.provider,
		Model:       filter.model,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load usage totals")
		return
	}

	rows, err := h.queries.ListAdminUsageByDimension(r.Context(), db.ListAdminUsageByDimensionParams{
		GroupBy:     filter.groupBy,
		Limit:       usageRowLimit,
		FromAt:      timestamp(filter.from),
		ToAt:        timestamp(filter.to),
		MinIssues:   minIssuesForUsage,
		WorkspaceID: filter.workspaceID,
		Provider:    filter.provider,
		Model:       filter.model,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load usage")
		return
	}

	resp := adminUsageResponse{
		GroupBy: filter.groupBy,
		From:    filter.from.Format(time.RFC3339),
		To:      filter.to.Format(time.RFC3339),
		Totals:  usageTotalsResponse(totals),
		Rows:    make([]adminUsageRow, len(rows)),
	}
	for i, row := range rows {
		resp.Rows[i] = adminUsageRow{
			ID:               row.ID,
			Name:             row.Name,
			WorkspaceID:      row.WorkspaceID,
			WorkspaceName:    row.WorkspaceName,
			WorkspaceSlug:    row.WorkspaceSlug,
			Provider:         row.Provider,
			Model:            row.Model,
			InputTokens:      row.InputTokens,
			OutputTokens:     row.OutputTokens,
			CacheReadTokens:  row.CacheReadTokens,
			CacheWriteTokens: row.CacheWriteTokens,
			CostUsdTicks:     row.CostUsdTicks,
			CostUSD:          float64(row.CostUsdTicks) / 1e10,
			TaskCount:        row.TaskCount,
			AgentCount:       row.AgentCount,
			DurationSeconds:  row.DurationSeconds,
			IssueCount:       row.IssueCount,
			LastActiveAt:     timestampString(row.LastBucket),
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) UsageTrend(w http.ResponseWriter, r *http.Request) {
	filter := parseUsageFilter(r, time.Now().UTC())
	bucket := queryValue(r.URL.Query(), "bucket")
	if bucket != "week" {
		bucket = "day"
	}

	rows, err := h.queries.ListAdminUsageTrend(r.Context(), db.ListAdminUsageTrendParams{
		Bucket:      bucket,
		FromAt:      timestamp(filter.from),
		ToAt:        timestamp(filter.to),
		MinIssues:   minIssuesForUsage,
		WorkspaceID: filter.workspaceID,
		Provider:    filter.provider,
		Model:       filter.model,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load usage trend")
		return
	}

	resp := adminUsageTrendResponse{
		Bucket: bucket,
		From:   filter.from.Format(time.RFC3339),
		To:     filter.to.Format(time.RFC3339),
		Points: make([]adminUsageTrendPoint, len(rows)),
	}
	for i, row := range rows {
		resp.Points[i] = adminUsageTrendPoint{
			BucketStart:     timestampString(row.BucketStart),
			WorkspaceID:     row.WorkspaceID,
			WorkspaceName:   row.WorkspaceName,
			InputTokens:     row.InputTokens,
			OutputTokens:    row.OutputTokens,
			CacheReadTokens: row.CacheReadTokens,
			TaskCount:       row.TaskCount,
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) UsageMatrix(w http.ResponseWriter, r *http.Request) {
	filter := parseUsageFilter(r, time.Now().UTC())

	rows, err := h.queries.ListAdminUsageMatrix(r.Context(), db.ListAdminUsageMatrixParams{
		FromAt:      timestamp(filter.from),
		ToAt:        timestamp(filter.to),
		MinIssues:   minIssuesForUsage,
		WorkspaceID: filter.workspaceID,
		Provider:    filter.provider,
		Model:       filter.model,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load usage matrix")
		return
	}

	resp := adminUsageMatrixResponse{
		From:  filter.from.Format(time.RFC3339),
		To:    filter.to.Format(time.RFC3339),
		Cells: make([]adminUsageMatrixCell, len(rows)),
	}
	for i, row := range rows {
		resp.Cells[i] = adminUsageMatrixCell{
			WorkspaceID:     row.WorkspaceID,
			WorkspaceName:   row.WorkspaceName,
			Provider:        row.Provider,
			Model:           row.Model,
			InputTokens:     row.InputTokens,
			OutputTokens:    row.OutputTokens,
			CacheReadTokens: row.CacheReadTokens,
			TaskCount:       row.TaskCount,
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
