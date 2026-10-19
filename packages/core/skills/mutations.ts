import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Skill, SkillScope } from "../types";
import { workspaceKeys } from "../workspace/queries";

/**
 * Promotes a workspace skill to the global namespace, or moves a global skill
 * back into the current workspace.
 *
 * Global changes are broadcast to every workspace by the server; this local
 * invalidation keeps the initiating workspace immediate.
 */
export function useSetSkillScope(wsId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillId,
      scope,
    }: {
      skillId: string;
      scope: SkillScope;
    }) => api.setSkillScope(skillId, scope),
    onSuccess: (skill: Skill) => {
      queryClient.setQueryData([...workspaceKeys.skills(wsId), skill.id], skill);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      // Agent payloads embed each skill's scope for badges and permission
      // hints, so the cached agent list is stale after a scope change.
      queryClient.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
    },
  });
}
