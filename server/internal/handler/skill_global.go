package handler

import (
	"net/http"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// publishSkillUpdated routes a skill:* event. Workspace skills stay in their
// workspace room; global skills publish with an empty workspace so the
// realtime listener can broadcast them to every workspace.
func (h *Handler) publishSkillUpdated(r *http.Request, skill db.Skill, resp SkillResponse) {
	actorType, actorID := h.resolveActor(r, requestUserID(r), h.resolveWorkspaceID(r))
	h.publish(protocol.EventSkillUpdated, uuidToString(skill.WorkspaceID), actorType, actorID, map[string]any{"skill": resp})
}
