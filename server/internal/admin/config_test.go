package admin

import "testing"

func TestParseEmails(t *testing.T) {
	got := parseEmails(" WadeWang@Rayootech.com , dannyzhang@rayootech.com,WadeWang@rayootech.com, ")
	if len(got) != 2 {
		t.Fatalf("expected 2 unique emails, got %v", got)
	}
	if got[0] != "wadewang@rayootech.com" || got[1] != "dannyzhang@rayootech.com" {
		t.Fatalf("unexpected emails: %v", got)
	}
}

func TestConfigAllows(t *testing.T) {
	cfg := Config{BootstrapEmails: []string{"wadewang@rayootech.com", "dannyzhang@rayootech.com"}}
	tests := []struct {
		email string
		want  bool
	}{
		{"wadewang@rayootech.com", true},
		{"WadeWang@Rayootech.com", true},
		{"other@rayootech.com", false},
		{"", false},
	}
	for _, test := range tests {
		if got := cfg.allows(test.email); got != test.want {
			t.Errorf("allows(%q) = %v, want %v", test.email, got, test.want)
		}
	}
}

func TestDefaultBootstrapEmails(t *testing.T) {
	t.Setenv(PlatformAdminEmailsEnv, "")
	cfg := ConfigFromEnv()
	if len(cfg.BootstrapEmails) != 2 {
		t.Fatalf("expected the two fork defaults, got %v", cfg.BootstrapEmails)
	}
}
