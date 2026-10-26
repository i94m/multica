package admin

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/util"
)

func TestCursorRoundTrip(t *testing.T) {
	id, err := util.ParseUUID("8a3f0d5e-3b7a-4e2c-9d1f-2a6b7c8d9e0f")
	if err != nil {
		t.Fatal(err)
	}
	createdAt := pgtype.Timestamptz{Time: time.Date(2026, 10, 26, 9, 30, 0, 0, time.UTC), Valid: true}

	encoded := encodeCursor(createdAt, id)
	if encoded == nil {
		t.Fatal("expected a cursor")
	}
	gotTime, gotID, ok := decodeCursor(*encoded)
	if !ok {
		t.Fatal("cursor did not decode")
	}
	if !gotTime.Time.Equal(createdAt.Time) {
		t.Fatalf("time = %v, want %v", gotTime.Time, createdAt.Time)
	}
	if util.UUIDToString(gotID) != util.UUIDToString(id) {
		t.Fatalf("id = %v, want %v", gotID, id)
	}
}

func TestDecodeCursorRejectsGarbage(t *testing.T) {
	if _, _, ok := decodeCursor("not-a-cursor"); ok {
		t.Fatal("expected invalid cursor to be rejected")
	}
}

func TestPageFromTrimsExtraRow(t *testing.T) {
	type row struct {
		created string
		id      string
	}
	rows := []row{
		{"2026-10-26T09:30:00Z", "8a3f0d5e-3b7a-4e2c-9d1f-2a6b7c8d9e0f"},
		{"2026-10-25T09:30:00Z", "8a3f0d5e-3b7a-4e2c-9d1f-2a6b7c8d9e01"},
	}
	page := pageFrom(rows, 1, func(item row) (pgtype.Timestamptz, pgtype.UUID) {
		return cursorFromStrings(item.created, item.id)
	})
	if len(page.Items) != 1 || !page.HasMore || page.NextCursor == nil {
		t.Fatalf("unexpected page: %+v", page)
	}
}
