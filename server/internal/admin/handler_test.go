package admin

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestParsePageRequestDefaults(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/admin/users", nil)
	got := parsePageRequest(req, map[string]bool{"created_at": true, "name": true}, "created_at")
	if got.Page != 1 || got.PageSize != defaultPageSize || got.Offset != 0 {
		t.Fatalf("unexpected defaults: %+v", got)
	}
	if got.SortKey != "created_at" || got.SortDir != "desc" {
		t.Fatalf("unexpected default sort: %+v", got)
	}
}

func TestParsePageRequestValidatesSortAndCapsPageSize(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/admin/users?page=3&page_size=999&sort=name&order=asc", nil)
	got := parsePageRequest(req, map[string]bool{"created_at": true, "name": true}, "created_at")
	if got.Page != 3 || got.PageSize != maxPageSize || got.Offset != int32(2*maxPageSize) {
		t.Fatalf("unexpected page: %+v", got)
	}
	if got.SortKey != "name" || got.SortDir != "asc" {
		t.Fatalf("unexpected sort: %+v", got)
	}

	req = httptest.NewRequest("GET", "/api/admin/users?sort=password&order=sideways", nil)
	got = parsePageRequest(req, map[string]bool{"created_at": true, "name": true}, "created_at")
	if got.SortKey != "created_at" || got.SortDir != "desc" {
		t.Fatalf("unknown sort should fall back: %+v", got)
	}
}

func TestNewPageResponse(t *testing.T) {
	req := pageRequest{Page: 2, PageSize: 25}
	page := newPageResponse([]string{"a"}, 51, req)
	if page.Total != 51 || page.TotalPages != 3 || !page.HasMore {
		t.Fatalf("unexpected page: %+v", page)
	}
	if page.Items == nil {
		t.Fatal("items should never be nil")
	}

	empty := newPageResponse[string](nil, 0, req)
	if empty.Items == nil || empty.TotalPages != 0 || empty.HasMore {
		t.Fatalf("unexpected empty page: %+v", empty)
	}
}

func TestUsageRangeDefaultsToLastWeek(t *testing.T) {
	now := time.Date(2026, 11, 19, 12, 0, 0, 0, time.UTC)

	from, to := usageRange(httptest.NewRequest("GET", "/api/admin/usage", nil), now)
	if !from.Equal(now.AddDate(0, 0, -7)) || !to.Equal(now) {
		t.Fatalf("unexpected default range: from=%s to=%s", from, to)
	}

	req := httptest.NewRequest("GET", "/api/admin/usage?from=2026-10-01&to=2026-10-08", nil)
	from, to = usageRange(req, now)
	if got := from.Format("2006-01-02"); got != "2026-10-01" {
		t.Fatalf("unexpected from: %s", got)
	}
	if got := to.Format("2006-01-02"); got != "2026-10-08" {
		t.Fatalf("unexpected to: %s", got)
	}

	req = httptest.NewRequest("GET", "/api/admin/usage?from=not-a-date", nil)
	from, _ = usageRange(req, now)
	if !from.Equal(now.AddDate(0, 0, -7)) {
		t.Fatalf("invalid from should fall back: %s", from)
	}
}

func TestUsageFilterValidatesDimensionAndFilters(t *testing.T) {
	now := time.Date(2026, 11, 19, 12, 0, 0, 0, time.UTC)

	filter := parseUsageFilter(httptest.NewRequest("GET", "/api/admin/usage?group_by=provider", nil), now)
	if filter.groupBy != "provider" || filter.workspaceID.Valid {
		t.Fatalf("unexpected filter: %+v", filter)
	}

	filter = parseUsageFilter(httptest.NewRequest("GET", "/api/admin/usage?group_by=password&workspace_id=nope", nil), now)
	if filter.groupBy != "workspace" {
		t.Fatalf("unknown dimension should fall back: %s", filter.groupBy)
	}
	if filter.workspaceID.Valid {
		t.Fatal("invalid workspace id should be ignored")
	}
}
