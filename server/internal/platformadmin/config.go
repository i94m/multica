// Package platformadmin holds the instance-level administrator configuration
// shared by the admin console and the handlers that gate instance-wide writes
// (global roles, for example).
//
// It lives in its own package because the admin console's route package imports
// the handler package: a handler that needs "is this caller a platform admin"
// cannot import the console without a cycle.
package platformadmin

import (
	"os"
	"strings"
)

// EmailsEnv is the optional bootstrap allowlist. The database table
// platform_admin remains the authoritative grant list; entries here are lazily
// inserted on first access so a fresh deployment can name its first
// administrators without a manual SQL step.
const EmailsEnv = "PLATFORM_ADMIN_EMAILS"

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
	emails := parseEmails(os.Getenv(EmailsEnv))
	if len(emails) == 0 {
		emails = append([]string(nil), forkDefaultAdminEmails...)
	}
	return Config{BootstrapEmails: emails}
}

// Allows reports whether email is on the bootstrap allowlist.
func (c Config) Allows(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false
	}
	for _, allowed := range c.BootstrapEmails {
		if strings.EqualFold(allowed, email) {
			return true
		}
	}
	return false
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
