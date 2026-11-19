package admin

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminUsageRow struct {
	ID            string  `json:"id,omitempty"`
	Name          string  `json:"name,omitempty"`
	WorkspaceID   string  `json:"workspace_id,omitempty"`
	WorkspaceName string  `json:"workspace_name,omitempty"`
	WorkspaceSlug string  `json:"workspace_slug,omitempty"`
	Provider      string  `json:"provider,omitempty"`
	Model         string  `json:"model,omitempty"`
	InputTokens   int64   `json:"input_tokens"`
	OutputTokens  int64   `json:"output_tokens"`
	CostUsdTicks  int64   `json:"cost_usd_ticks"`
	CostUSD       float64 `json:"cost_usd"`
	TaskCount     *int64  `json:"task_count,omitempty"`
}

type adminUsageResponse struct {
	GroupBy string                   `json:"group_by"`
	From    string                   `json:"from"`
	To      string                   `json:"to"`
	Totals  adminUsageTotalsResponse `json:"totals"`
	Rows    []adminUsageRow          `json:"rows"`
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
	}
}

// minIssuesForUsage drops personal workspaces from the cross-workspace usage
// report. They hold a handful of issues, so a busy individual would otherwise
// outweigh a real team in the token and task totals.
const minIssuesForUsage = 5

// defaultUsageDays keeps the report to the current week unless the caller asks
// for an explicit range.
const defaultUsageDays = 7

func usageRange(r *http.Request, now time.Time) (from, to time.Time) {
	values := r.URL.Query()
	from = timeParamOrDefault(queryValue(values, "from"), now.AddDate(0, 0, -defaultUsageDays))
	to = timeParamOrDefault(queryValue(values, "to"), now)
	return from, to
}

func (h *Handler) Usage(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	from, to := usageRange(r, time.Now().UTC())
	groupBy := queryValue(values, "group_by")
	if groupBy == "" {
		groupBy = "workspace"
	}

	params := db.AdminUsageTotalsParams{
		BucketHour:   pgtype.Timestamptz{Time: from, Valid: true},
		BucketHour_2: pgtype.Timestamptz{Time: to, Valid: true},
		MinIssues:    minIssuesForUsage,
	}
	totals, err := h.queries.AdminUsageTotals(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load usage totals")
		return
	}

	resp := adminUsageResponse{
		GroupBy: groupBy,
		From:    from.Format(time.RFC3339),
		To:      to.Format(time.RFC3339),
		Totals:  usageTotalsResponse(totals),
		Rows:    []adminUsageRow{},
	}

	switch groupBy {
	case "agent":
		rows, err := h.queries.ListAdminUsageByAgent(r.Context(), db.ListAdminUsageByAgentParams{
			BucketHour:   params.BucketHour,
			BucketHour_2: params.BucketHour_2,
			MinIssues:    minIssuesForUsage,
			Limit:        100,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load agent usage")
			return
		}
		for _, row := range rows {
			resp.Rows = append(resp.Rows, adminUsageRow{
				ID:            uuidString(row.AgentID),
				Name:          row.AgentName,
				WorkspaceID:   uuidString(row.WorkspaceID),
				WorkspaceName: row.WorkspaceName,
				InputTokens:   row.InputTokens,
				OutputTokens:  row.OutputTokens,
				CostUsdTicks:  row.CostUsdTicks,
				CostUSD:       float64(row.CostUsdTicks) / 1e10,
			})
		}
	case "model":
		rows, err := h.queries.ListAdminUsageByModel(r.Context(), db.ListAdminUsageByModelParams{
			BucketHour:   params.BucketHour,
			BucketHour_2: params.BucketHour_2,
			MinIssues:    minIssuesForUsage,
			Limit:        100,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load model usage")
			return
		}
		for _, row := range rows {
			taskCount := row.TaskCount
			resp.Rows = append(resp.Rows, adminUsageRow{
				Provider:     row.Provider,
				Model:        row.Model,
				InputTokens:  row.InputTokens,
				OutputTokens: row.OutputTokens,
				CostUsdTicks: row.CostUsdTicks,
				CostUSD:      float64(row.CostUsdTicks) / 1e10,
				TaskCount:    &taskCount,
			})
		}
	default:
		rows, err := h.queries.ListAdminUsageByWorkspace(r.Context(), db.ListAdminUsageByWorkspaceParams{
			BucketHour:   params.BucketHour,
			BucketHour_2: params.BucketHour_2,
			MinIssues:    minIssuesForUsage,
			Limit:        100,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load workspace usage")
			return
		}
		for _, row := range rows {
			resp.Rows = append(resp.Rows, adminUsageRow{
				ID:            uuidString(row.WorkspaceID),
				Name:          row.WorkspaceName,
				WorkspaceID:   uuidString(row.WorkspaceID),
				WorkspaceName: row.WorkspaceName,
				WorkspaceSlug: row.WorkspaceSlug,
				InputTokens:   row.InputTokens,
				OutputTokens:  row.OutputTokens,
				CostUsdTicks:  row.CostUsdTicks,
				CostUSD:       float64(row.CostUsdTicks) / 1e10,
			})
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
