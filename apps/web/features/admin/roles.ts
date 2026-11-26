import { z } from "zod";
import { adminRequest } from "./request";

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

export const rolesApi = {
  list: (): Promise<{ roles: AdminRole[] }> =>
    adminRequest<{ roles: AdminRole[] }>("/api/admin/agent-roles", roleListSchema, { roles: [] }),
  create: (data: { name: string; description: string; instructions: string }) =>
    adminRequest("/api/admin/agent-roles", roleSchema, emptyRole(), "POST", data),
  update: (
    id: string,
    data: { name: string; description: string; instructions: string },
  ) =>
    adminRequest(`/api/admin/agent-roles/${id}`, roleSchema, emptyRole(), "PUT", data),
  remove: (id: string) =>
    adminRequest(`/api/admin/agent-roles/${id}`, z.unknown(), undefined, "DELETE"),
  skills: (id: string): Promise<{ skills: AdminRoleSkill[] }> =>
    adminRequest<{ skills: AdminRoleSkill[] }>(
      `/api/admin/agent-roles/${id}/skills`,
      roleSkillsSchema,
      { skills: [] },
    ),
  setSkills: (id: string, skillIds: string[]): Promise<{ skills: AdminRoleSkill[] }> =>
    adminRequest<{ skills: AdminRoleSkill[] }>(
      `/api/admin/agent-roles/${id}/skills`,
      roleSkillsSchema,
      { skills: [] },
      "PUT",
      { skill_ids: skillIds },
    ),
  skillPool: (): Promise<{ skills: AdminRoleSkill[] }> =>
    adminRequest<{ skills: AdminRoleSkill[] }>("/api/admin/skills", roleSkillsSchema, { skills: [] }),
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
