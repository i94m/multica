package admin

import "testing"

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
		if got := cfg.Allows(test.email); got != test.want {
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
