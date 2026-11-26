import { z } from "zod";
import { adminRequest } from "./request";

// The global skill pool. A global skill belongs to no workspace and every
// workspace sees it; only the console changes a skill's scope.

const globalSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  roles: z.array(z.string()).default([]),
  creator_name: z.string().default(""),
  creator_email: z.string().default(""),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
});

const globalSkillListSchema = z.object({ skills: z.array(globalSkillSchema) });

const workspaceSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  updated_at: z.string().default(""),
});

const workspaceSkillListSchema = z.object({ skills: z.array(workspaceSkillSchema) });

export type AdminGlobalSkill = z.infer<typeof globalSkillSchema>;
export type AdminWorkspaceSkill = z.infer<typeof workspaceSkillSchema>;

export const skillsApi = {
  listGlobal: (): Promise<{ skills: AdminGlobalSkill[] }> =>
    adminRequest<{ skills: AdminGlobalSkill[] }>(
      "/api/admin/global-skills",
      globalSkillListSchema,
      { skills: [] },
    ),
  listWorkspace: (workspaceId: string): Promise<{ skills: AdminWorkspaceSkill[] }> =>
    adminRequest<{ skills: AdminWorkspaceSkill[] }>(
      `/api/admin/workspaces/${encodeURIComponent(workspaceId)}/skills`,
      workspaceSkillListSchema,
      { skills: [] },
    ),
  promote: (skillId: string): Promise<AdminGlobalSkill> =>
    adminRequest<AdminGlobalSkill>(
      `/api/admin/skills/${encodeURIComponent(skillId)}/promote`,
      globalSkillSchema,
      {
        id: "",
        name: "",
        description: "",
        roles: [],
        creator_name: "",
        creator_email: "",
        created_at: "",
        updated_at: "",
      },
      "POST",
    ),
  demote: (skillId: string, workspaceId: string): Promise<AdminWorkspaceSkill> =>
    adminRequest<AdminWorkspaceSkill>(
      `/api/admin/global-skills/${encodeURIComponent(skillId)}/demote`,
      workspaceSkillSchema,
      { id: "", name: "", description: "", updated_at: "" },
      "POST",
      { workspace_id: workspaceId },
    ),
};
