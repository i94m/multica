package admin

import "github.com/multica-ai/multica/server/internal/platformadmin"

// The instance-level grant configuration lives in internal/platformadmin so
// handlers can ask "is this caller a platform admin" without importing the
// console. These aliases keep the console's call sites unchanged.

type Config = platformadmin.Config

// PlatformAdminEmailsEnv is the optional bootstrap allowlist.
const PlatformAdminEmailsEnv = platformadmin.EmailsEnv

func ConfigFromEnv() Config { return platformadmin.ConfigFromEnv() }
