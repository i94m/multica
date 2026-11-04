import { z } from "zod";
import { api } from "@multica/core/api";
import { parseWithFallback } from "@multica/core/api/schema";
import { useAuthStore } from "@multica/core/auth";
import { AdminApiError } from "./api";

// Roles are platform-level: the console is the only place they are created or
// edited, and a role may only grant global skills.

const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  instructions: z.string().default(""),
  agent_count: z.number().default(0),
  skill_count: z.number().default(0),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
});

const roleListSchema = z.object({ roles: z.array(roleSchema) });

const roleSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
});

const roleSkillsSchema = z.object({ skills: z.array(roleSkillSchema) });

export type AdminRole = z.infer<typeof roleSchema>;
export type AdminRoleSkill = z.infer<typeof roleSkillSchema>;

async function request<T>(
  path: string,
  schema: z.ZodType,
  fallback: T,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = api.getToken();
  const response = await fetch(`${api.getBaseUrl()}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 && useAuthStore.getState().user) {
    useAuthStore.getState().sessionExpired();
  }
  if (!response.ok) {
    let message = `Admin API error: ${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // keep the status line
    }
    throw new AdminApiError(message, response.status);
  }
  if (response.status === 204) return fallback;
  const raw = (await response.json()) as unknown;
  return parseWithFallback(raw, schema, fallback, { endpoint: path });
}

export const rolesApi = {
  list: (): Promise<{ roles: AdminRole[] }> =>
    request<{ roles: AdminRole[] }>("/api/admin/agent-roles", roleListSchema, { roles: [] }),
  create: (data: { name: string; description: string; instructions: string }) =>
    request("/api/admin/agent-roles", roleSchema, emptyRole(), "POST", data),
  update: (
    id: string,
    data: { name: string; description: string; instructions: string },
  ) =>
    request(`/api/admin/agent-roles/${id}`, roleSchema, emptyRole(), "PUT", data),
  remove: (id: string) =>
    request(`/api/admin/agent-roles/${id}`, z.unknown(), undefined, "DELETE"),
  skills: (id: string): Promise<{ skills: AdminRoleSkill[] }> =>
    request<{ skills: AdminRoleSkill[] }>(
      `/api/admin/agent-roles/${id}/skills`,
      roleSkillsSchema,
      { skills: [] },
    ),
  setSkills: (id: string, skillIds: string[]): Promise<{ skills: AdminRoleSkill[] }> =>
    request<{ skills: AdminRoleSkill[] }>(
      `/api/admin/agent-roles/${id}/skills`,
      roleSkillsSchema,
      { skills: [] },
      "PUT",
      { skill_ids: skillIds },
    ),
  skillPool: (): Promise<{ skills: AdminRoleSkill[] }> =>
    request<{ skills: AdminRoleSkill[] }>("/api/admin/skills", roleSkillsSchema, { skills: [] }),
};

function emptyRole(): AdminRole {
  return {
    id: "",
    name: "",
    description: "",
    instructions: "",
    agent_count: 0,
    skill_count: 0,
    created_at: "",
    updated_at: "",
  };
}
