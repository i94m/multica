package admin

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type adminCountsResponse struct {
	Users           int64 `json:"users"`
	Workspaces      int64 `json:"workspaces"`
	Members         int64 `json:"members"`
	Issues          int64 `json:"issues"`
	Agents          int64 `json:"agents"`
	RuntimesOnline  int64 `json:"runtimes_online"`
	RuntimesOffline int64 `json:"runtimes_offline"`
	TasksActive     int64 `json:"tasks_active"`
	TasksFailed24h  int64 `json:"tasks_failed_24h"`
	Tasks24h        int64 `json:"tasks_24h"`
}

type adminUsageTotalsResponse struct {
	InputTokens      int64   `json:"input_tokens"`
	OutputTokens     int64   `json:"output_tokens"`
	CacheReadTokens  int64   `json:"cache_read_tokens"`
	CacheWriteTokens int64   `json:"cache_write_tokens"`
	CostUsdTicks     int64   `json:"cost_usd_ticks"`
	CostUSD          float64 `json:"cost_usd"`
	TaskCount        int64   `json:"task_count"`
}

type adminCountResponse struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

type adminDailySignupsResponse struct {
	Day   string `json:"day"`
	Count int64  `json:"count"`
}

type adminDailyTasksResponse struct {
	Day       string `json:"day"`
	Completed int64  `json:"completed"`
	Failed    int64  `json:"failed"`
}

type adminOverviewResponse struct {
	Counts        adminCountsResponse         `json:"counts"`
	TasksByStatus []adminCountResponse        `json:"tasks_by_status"`
	Usage         adminUsageTotalsResponse    `json:"usage"`
	SignupsDaily  []adminDailySignupsResponse `json:"signups_daily"`
	TasksDaily    []adminDailyTasksResponse   `json:"tasks_daily"`
	GeneratedAt   string                      `json:"generated_at"`
}

func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	now := time.Now().UTC()
	from := timeParamOrDefault(queryValue(values, "from"), now.AddDate(0, 0, -30))
	to := timeParamOrDefault(queryValue(values, "to"), now)

	counts, err := h.queries.AdminOverviewCounts(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load overview counts")
		return
	}
	statuses, err := h.queries.AdminTasksByStatus(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load task statuses")
		return
	}
	usage, err := h.queries.AdminUsageTotals(r.Context(), db.AdminUsageTotalsParams{
		BucketHour:   pgtype.Timestamptz{Time: from, Valid: true},
		BucketHour_2: pgtype.Timestamptz{Time: to, Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load usage")
		return
	}
	signups, err := h.queries.AdminSignupsDaily(r.Context(), pgtype.Timestamptz{Time: from, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load signups")
		return
	}
	tasksDaily, err := h.queries.AdminTasksDaily(r.Context(), pgtype.Timestamptz{Time: from, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load daily tasks")
		return
	}

	resp := adminOverviewResponse{
		Counts: adminCountsResponse{
			Users:           counts.Users,
			Workspaces:      counts.Workspaces,
			Members:         counts.Members,
			Issues:          counts.Issues,
			Agents:          counts.Agents,
			RuntimesOnline:  counts.RuntimesOnline,
			RuntimesOffline: counts.RuntimesOffline,
			TasksActive:     counts.TasksActive,
			TasksFailed24h:  counts.TasksFailed24h,
			Tasks24h:        counts.Tasks24h,
		},
		TasksByStatus: make([]adminCountResponse, len(statuses)),
		Usage:         usageTotalsResponse(usage),
		SignupsDaily:  make([]adminDailySignupsResponse, len(signups)),
		TasksDaily:    make([]adminDailyTasksResponse, len(tasksDaily)),
		GeneratedAt:   now.Format(time.RFC3339),
	}
	for i, status := range statuses {
		resp.TasksByStatus[i] = adminCountResponse{Status: status.Status, Count: status.Count}
	}
	for i, row := range signups {
		resp.SignupsDaily[i] = adminDailySignupsResponse{Day: dateString(row.Day), Count: row.Count}
	}
	for i, row := range tasksDaily {
		resp.TasksDaily[i] = adminDailyTasksResponse{Day: dateString(row.Day), Completed: row.Completed, Failed: row.Failed}
	}
	writeJSON(w, http.StatusOK, resp)
}
