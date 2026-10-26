package admin

import (
	"os"
	"strings"
)

// PlatformAdminEmailsEnv is the optional bootstrap allowlist. The database
// table platform_admin remains the authoritative grant list; entries here are
// lazily inserted on first access so a fresh deployment can name its first
// administrators without a manual SQL step.
const PlatformAdminEmailsEnv = "PLATFORM_ADMIN_EMAILS"

// forkDefaultAdminEmails is the temporary allowlist for this deployment.
// Override it with PLATFORM_ADMIN_EMAILS. Remove once admin grants are
// managed from the UI.
var forkDefaultAdminEmails = []string{
	"wadewang@rayootech.com",
	"dannyzhang@rayootech.com",
}

type Config struct {
	BootstrapEmails []string
}

func ConfigFromEnv() Config {
	emails := parseEmails(os.Getenv(PlatformAdminEmailsEnv))
	if len(emails) == 0 {
		emails = append([]string(nil), forkDefaultAdminEmails...)
	}
	return Config{BootstrapEmails: emails}
}

func parseEmails(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	seen := make(map[string]struct{})
	out := make([]string, 0, 4)
	for _, part := range strings.Split(raw, ",") {
		email := strings.ToLower(strings.TrimSpace(part))
		if email == "" {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		out = append(out, email)
	}
	return out
}

func (c Config) allows(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false
	}
	for _, allowed := range c.BootstrapEmails {
		if allowed == email {
			return true
		}
	}
	return false
}
