import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentRole,
  AgentSkillSummary,
  CreateAgentRoleRequest,
  UpdateAgentRoleRequest,
} from "../types";
import { workspaceKeys } from "../workspace/queries";

export const agentRoleKeys = {
  all: (wsId: string) => ["workspaces", wsId, "agent-roles"] as const,
  list: (wsId: string) => [...agentRoleKeys.all(wsId), "list"] as const,
};

export const agentRoleSkillKeys = {
  list: (wsId: string, roleId: string) =>
    [...agentRoleKeys.all(wsId), "skills", roleId] as const,
};

export function agentRoleSkillsOptions(wsId: string, roleId: string | null) {
  return queryOptions({
    queryKey: agentRoleSkillKeys.list(wsId, roleId ?? ""),
    queryFn: () => api.listAgentRoleSkills(roleId ?? ""),
    enabled: !!wsId && !!roleId,
  });
}

export function useSetAgentRoleSkills(wsId: string, roleId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillIds: string[]) =>
      api.setAgentRoleSkills(roleId ?? "", skillIds),
    onSuccess: (skills: AgentSkillSummary[]) => {
      queryClient.setQueryData(
        agentRoleSkillKeys.list(wsId, roleId ?? ""),
        skills,
      );
      // Agents on this role gain/lose skills on their next run; refresh the
      // agent surfaces that render the effective set.
      queryClient.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: agentRoleSkillKeys.list(wsId, roleId ?? ""),
      });
    },
  });
}

export function agentRoleListOptions(wsId: string) {
  return queryOptions({
    queryKey: agentRoleKeys.list(wsId),
    queryFn: () => api.listAgentRoles(),
    enabled: !!wsId,
  });
}

function useInvalidateAgentRoles(wsId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: agentRoleKeys.all(wsId) });
    // Agent payloads carry role_id; a role rename/default change must refresh
    // the pickers and detail surfaces that map ids back to names.
    queryClient.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
  };
}

export function useCreateAgentRole(wsId: string) {
  const invalidate = useInvalidateAgentRoles(wsId);
  return useMutation({
    mutationFn: (data: CreateAgentRoleRequest) => api.createAgentRole(data),
    onSuccess: invalidate,
  });
}

export function useUpdateAgentRole(wsId: string) {
  const invalidate = useInvalidateAgentRoles(wsId);
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateAgentRoleRequest;
    }) => api.updateAgentRole(id, data),
    onSuccess: (role: AgentRole) => {
      invalidate();
      return role;
    },
  });
}

export function useDeleteAgentRole(wsId: string) {
  const invalidate = useInvalidateAgentRoles(wsId);
  return useMutation({
    mutationFn: (id: string) => api.deleteAgentRole(id),
    onSuccess: invalidate,
  });
}

