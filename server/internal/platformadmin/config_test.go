package platformadmin

import "testing"

func TestParseEmails(t *testing.T) {
	got := parseEmails(" WadeWang@Rayootech.com , dannyzhang@rayootech.com,WadeWang@Rayootech.com, ")
	if len(got) != 2 {
		t.Fatalf("expected 2 unique emails, got %v", got)
	}
	if got[0] != "wadewang@rayootech.com" || got[1] != "dannyzhang@rayootech.com" {
		t.Fatalf("unexpected emails: %v", got)
	}
}

func TestAllows(t *testing.T) {
	cfg := Config{BootstrapEmails: []string{"wadewang@rayootech.com"}}
	if !cfg.Allows("WadeWang@Rayootech.com") {
		t.Fatalf("expected case-insensitive allow")
	}
	if cfg.Allows("other@rayootech.com") || cfg.Allows("") {
		t.Fatalf("unexpected allow")
	}
}
