package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const (
	defaultPageSize = 25
	maxPageSize     = 100
)

type Handler struct {
	queries *db.Queries
}

type pageRequest struct {
	Page     int
	PageSize int32
	Offset   int32
	SortKey  string
	SortDir  string
}

type pageResponse[T any] struct {
	Items      []T     `json:"items"`
	Total      int64   `json:"total"`
	Page       int     `json:"page"`
	PageSize   int32   `json:"page_size"`
	TotalPages int     `json:"total_pages"`
	NextCursor *string `json:"next_cursor"`
	HasMore    bool    `json:"has_more"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		body = []byte(`{"error":"failed to encode response"}`)
		status = http.StatusInternalServerError
	}
	body = append(body, '\n')
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeDBError(w http.ResponseWriter, err error, notFoundMsg, failureMsg string) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, notFoundMsg)
		return
	}
	writeError(w, http.StatusInternalServerError, failureMsg)
}

func requestUserID(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

func parseUUIDParam(w http.ResponseWriter, raw, field string) (pgtype.UUID, bool) {
	id, err := util.ParseUUID(raw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid "+field)
		return pgtype.UUID{}, false
	}
	return id, true
}

func nullableUUID(raw string) pgtype.UUID {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return pgtype.UUID{}
	}
	id, err := util.ParseUUID(raw)
	if err != nil {
		return pgtype.UUID{}
	}
	return id
}

func nullableTime(raw string) pgtype.Timestamptz {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return pgtype.Timestamptz{}
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return pgtype.Timestamptz{Time: t, Valid: true}
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return pgtype.Timestamptz{Time: t, Valid: true}
	}
	return pgtype.Timestamptz{}
}

func timeParamOrDefault(raw string, fallback time.Time) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return t
	}
	return fallback
}

func queryValue(values url.Values, key string) string {
	return strings.TrimSpace(values.Get(key))
}

// parsePageRequest implements the traditional page/page_size contract shared
// by every admin list. Sort keys are validated against the caller's whitelist;
// unknown keys fall back to the endpoint default instead of reaching SQL.
func parsePageRequest(r *http.Request, allowedSorts map[string]bool, defaultSort string) pageRequest {
	values := r.URL.Query()
	page := 1
	if parsed, err := strconv.Atoi(queryValue(values, "page")); err == nil && parsed > 0 {
		page = parsed
	}
	size := defaultPageSize
	if parsed, err := strconv.Atoi(queryValue(values, "page_size")); err == nil && parsed > 0 {
		size = parsed
	}
	if size > maxPageSize {
		size = maxPageSize
	}

	sortKey := queryValue(values, "sort")
	if sortKey == "" || !allowedSorts[sortKey] {
		sortKey = defaultSort
	}
	sortDir := strings.ToLower(queryValue(values, "order"))
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	return pageRequest{
		Page:     page,
		PageSize: int32(size),
		Offset:   int32((page - 1) * size),
		SortKey:  sortKey,
		SortDir:  sortDir,
	}
}

func newPageResponse[T any](items []T, total int64, req pageRequest) pageResponse[T] {
	if items == nil {
		items = []T{}
	}
	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(req.PageSize) - 1) / int64(req.PageSize))
	}
	return pageResponse[T]{
		Items:      items,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: totalPages,
		HasMore:    int64(req.Page)*int64(req.PageSize) < total,
	}
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

// timestampString keeps sub-second precision. Admin responses are also used to
// reconstruct sort/filter state, so truncating to seconds loses ordering
// information for rows created in the same second.
func timestampString(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format(time.RFC3339Nano)
}

func timePtr(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	s := value.Time.Format(time.RFC3339Nano)
	return &s
}

func int4Ptr(value pgtype.Int4) *int32 {
	if !value.Valid {
		return nil
	}
	return &value.Int32
}

func uuidString(value pgtype.UUID) string {
	return util.UUIDToString(value)
}

func dateString(value pgtype.Date) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format("2006-01-02")
}

func truncate(value string, max int) string {
	if max <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max]) + "…"
}
