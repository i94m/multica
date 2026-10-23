package handler

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// composeAgentRoleInstructions builds the effective Agent Identity prompt for
// one run:
//
//	explicit agent role + agent-specific instructions
//
// Role text is read on every claim, so editing a role reaches every linked
// agent on its next run with no agent-row rewrite. A missing or unreadable role
// degrades to the agent-specific instructions instead of failing the task.
func (h *Handler) composeAgentRoleInstructions(ctx context.Context, agent db.Agent) string {
	// System agents (Mika, builder carriers) own a product-defined prompt and
	// must never inherit workspace user configuration.
	if agent.Kind == "system" {
		return agent.Instructions
	}

	parts := make([]string, 0, 2)
	if agent.RoleID.Valid {
		role, err := h.Queries.GetAgentRoleVisibleInWorkspace(ctx, db.GetAgentRoleVisibleInWorkspaceParams{
			ID:          agent.RoleID,
			WorkspaceID: agent.WorkspaceID,
		})
		if err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				slog.Warn("agent role: load assigned role failed",
					"agent_id", util.UUIDToString(agent.ID), "role_id", util.UUIDToString(agent.RoleID), "error", err)
			}
		} else if text := strings.TrimSpace(role.Instructions); text != "" {
			parts = append(parts, text)
		}
	}

	if text := strings.TrimSpace(agent.Instructions); text != "" {
		parts = append(parts, text)
	}
	return joinAgentInstructionParts(parts...)
}

// joinAgentInstructionParts concatenates non-empty prompt layers with one blank
// line between them. Empty layers disappear entirely, so an unconfigured role
// cannot leave a dangling separator in the Agent Identity section.
func joinAgentInstructionParts(parts ...string) string {
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	return strings.Join(clean, "\n\n")
}
