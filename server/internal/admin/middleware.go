package admin

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// RequirePlatformAdmin gates the admin API. It deliberately hides the whole
// surface with 404 when no administrator has ever been configured, and with
// 403 for signed-in non-admins. A cross-workspace read console is an
// instance-level capability; it must never be reachable through a workspace
// role or an agent task token.
func RequirePlatformAdmin(queries *db.Queries, cfg Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := r.Header.Get("X-User-ID")
			if userID == "" {
				writeError(w, http.StatusUnauthorized, "user not authenticated")
				return
			}

			anyAdmin, err := queries.HasAnyPlatformAdmin(r.Context())
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to check platform admins")
				return
			}
			enabled := anyAdmin || len(cfg.BootstrapEmails) > 0
			if !enabled {
				writeError(w, http.StatusNotFound, "not found")
				return
			}

			uid, err := util.ParseUUID(userID)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid user identity")
				return
			}

			allowed, err := isAllowed(r, queries, cfg, uid)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to verify platform admin")
				return
			}
			if !allowed {
				writeError(w, http.StatusForbidden, "platform admin access required")
				return
			}

			// Admin reads expose cross-workspace PII. Keep an audit trail in the
			// server log even though the API itself is read-only.
			slog.Info("platform admin request",
				"user_id", userID,
				"method", r.Method,
				"path", r.URL.Path,
			)
			next.ServeHTTP(w, r)
		})
	}
}

func isAllowed(r *http.Request, queries *db.Queries, cfg Config, uid pgtype.UUID) (bool, error) {
	inTable, err := queries.IsPlatformAdmin(r.Context(), uid)
	if err != nil {
		return false, err
	}
	if inTable {
		return true, nil
	}

	user, err := queries.GetUser(r.Context(), uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if !cfg.allows(user.Email) {
		return false, nil
	}

	// Lazy bootstrap: keep the env allowlist visible in the table so the
	// authoritative grant list reflects who actually has access.
	if err := queries.CreatePlatformAdmin(r.Context(), uid); err != nil {
		slog.Warn("failed to persist platform admin bootstrap", "user_id", util.UUIDToString(uid), "error", err)
	}
	return true, nil
}
