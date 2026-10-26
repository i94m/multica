package admin

import (
	"net/http/httptest"
	"testing"
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
