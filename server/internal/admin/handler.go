package admin

import (
	"encoding/base64"
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
	defaultPageLimit = 50
	maxPageLimit     = 200
)

type Handler struct {
	queries *db.Queries
}

type page[T any] struct {
	Items      []T     `json:"items"`
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

func parseLimit(raw string) int32 {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return defaultPageLimit
	}
	if value > maxPageLimit {
		return maxPageLimit
	}
	return int32(value)
}

func queryValue(values url.Values, key string) string {
	return strings.TrimSpace(values.Get(key))
}

type cursor struct {
	CreatedAt time.Time `json:"t"`
	ID        string    `json:"i"`
}

func encodeCursor(createdAt pgtype.Timestamptz, id pgtype.UUID) *string {
	if !createdAt.Valid || !id.Valid {
		return nil
	}
	raw, err := json.Marshal(cursor{
		CreatedAt: createdAt.Time.UTC(),
		ID:        util.UUIDToString(id),
	})
	if err != nil {
		return nil
	}
	encoded := base64.RawURLEncoding.EncodeToString(raw)
	return &encoded
}

func decodeCursor(raw string) (pgtype.Timestamptz, pgtype.UUID, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return pgtype.Timestamptz{}, pgtype.UUID{}, true
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}, false
	}
	var c cursor
	if err := json.Unmarshal(data, &c); err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}, false
	}
	id, err := util.ParseUUID(c.ID)
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}, false
	}
	return pgtype.Timestamptz{Time: c.CreatedAt, Valid: true}, id, true
}

func pageFrom[T any](items []T, limit int32, cursorFor func(T) (pgtype.Timestamptz, pgtype.UUID)) page[T] {
	hasMore := len(items) > int(limit)
	if hasMore {
		items = items[:limit]
	}
	var next *string
	if hasMore && len(items) > 0 {
		t, id := cursorFor(items[len(items)-1])
		next = encodeCursor(t, id)
	}
	if items == nil {
		items = []T{}
	}
	return page[T]{Items: items, NextCursor: next, HasMore: hasMore}
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

// timestampString keeps sub-second precision. Admin list cursors are derived
// from the serialized created_at value, and truncating to seconds makes two
// rows created in the same second skip each other on the next page.
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

// cursorFromStrings rebuilds a keyset cursor from an already-serialized
// response row, so list handlers do not have to keep the pgtype values around
// after mapping into their response shape.
func cursorFromStrings(createdAt, id string) (pgtype.Timestamptz, pgtype.UUID) {
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}
	}
	uid, err := util.ParseUUID(id)
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}
	}
	return pgtype.Timestamptz{Time: t, Valid: true}, uid
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
