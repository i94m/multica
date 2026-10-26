package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/handler"
	"github.com/multica-ai/multica/server/internal/middleware"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// RegisterRoutes mounts the fork-local platform admin API on the shared
// router. It is intentionally self-contained: one call site in router.go and
// no changes to the existing handler or middleware packages.
func RegisterRoutes(
	r chi.Router,
	queries *db.Queries,
	patCache *auth.PATCache,
	cloudPAT *auth.CloudPATVerifier,
	cfSigner *auth.CloudFrontSigner,
) {
	h := &Handler{queries: queries}
	cfg := ConfigFromEnv()

	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(queries, patCache, cloudPAT, cfSigner))
		r.Use(handler.RequireHumanActor)
		r.Use(RequirePlatformAdmin(queries, cfg))

		r.Route("/api/admin", func(r chi.Router) {
			r.Get("/me", h.Me)
			r.Get("/overview", h.Overview)

			r.Get("/users", h.ListUsers)
			r.Get("/users/{id}", h.GetUser)

			r.Get("/workspaces", h.ListWorkspaces)
			r.Get("/workspaces/{id}", h.GetWorkspace)

			r.Get("/tasks", h.ListTasks)
			r.Get("/tasks/{id}", h.GetTask)

			r.Get("/agents", h.ListAgents)
			r.Get("/agents/{id}", h.GetAgent)

			r.Get("/runtimes", h.ListRuntimes)
			r.Get("/runtimes/{id}", h.GetRuntime)

			r.Get("/usage", h.Usage)
		})
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"is_admin": true})
}
