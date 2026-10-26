import type { ZodType } from "zod";
import { z } from "zod";

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

const nullableNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);

function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item).default([]),
    total: z.number().default(0),
    page: z.number().default(1),
    page_size: z.number().default(25),
    total_pages: z.number().default(0),
    next_cursor: nullableString.optional().default(null),
    has_more: z.boolean().default(false),
  });
}

export const adminMeSchema = z.object({
  is_admin: z.boolean().default(false),
});

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  email: z.string().default(""),
  avatar_url: nullableString,
  created_at: z.string().default(""),
  onboarded_at: nullableString,
  workspace_count: z.number().default(0),
});

export const adminMembershipSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string().default(""),
  workspace_slug: z.string().default(""),
  role: z.string().default(""),
  created_at: z.string().default(""),
});

export const adminUserDetailSchema = adminUserSchema.extend({
  memberships: z.array(adminMembershipSchema).default([]),
});

export const adminUserPageSchema = pageSchema(adminUserSchema);

export const adminWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  slug: z.string().default(""),
  avatar_url: nullableString,
  created_at: z.string().default(""),
  member_count: z.number().default(0),
  issue_count: z.number().default(0),
  agent_count: z.number().default(0),
  runtime_count: z.number().default(0),
});

export const adminWorkspaceMemberSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string().default(""),
  email: z.string().default(""),
  avatar_url: nullableString,
  role: z.string().default(""),
  created_at: z.string().default(""),
});

export const adminWorkspaceDetailSchema = adminWorkspaceSchema.extend({
  members: z.array(adminWorkspaceMemberSchema).default([]),
});

export const adminWorkspacePageSchema = pageSchema(adminWorkspaceSchema);

export const adminTaskSchema = z.object({
  id: z.string(),
  agent_id: z.string().default(""),
  issue_id: z.string().default(""),
  runtime_id: z.string().default(""),
  status: z.string().default(""),
  created_at: z.string().default(""),
  started_at: nullableString,
  completed_at: nullableString,
  failure_reason: nullableString,
  error: nullableString,
  trigger_summary: nullableString,
  attempt: z.number().default(0),
  max_attempts: z.number().default(0),
  agent_name: z.string().default(""),
  workspace_id: z.string().default(""),
  workspace_name: z.string().default(""),
  workspace_slug: z.string().default(""),
  issue_number: nullableNumber,
  issue_title: nullableString,
  runtime_name: nullableString,
  input_tokens: z.number().default(0),
  output_tokens: z.number().default(0),
  cost_usd_ticks: z.number().default(0),
  cost_usd: z.number().default(0),
});

export const adminTaskUsageSchema = z.object({
  provider: z.string().default(""),
  model: z.string().default(""),
  input_tokens: z.number().default(0),
  output_tokens: z.number().default(0),
  cost_usd_ticks: z.number().default(0),
  cost_usd: z.number().default(0),
});

export const adminTaskDetailSchema = adminTaskSchema.extend({
  workflow_step: nullableString,
  branch_name: nullableString,
  usage: z.array(adminTaskUsageSchema).default([]),
});

export const adminTaskPageSchema = pageSchema(adminTaskSchema);

export const adminAgentSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  workspace_id: z.string().default(""),
  workspace_name: z.string().default(""),
  workspace_slug: z.string().default(""),
  status: z.string().default(""),
  kind: z.string().default(""),
  permission_mode: z.string().default(""),
  owner_id: z.string().default(""),
  owner_name: nullableString,
  owner_email: nullableString,
  runtime_id: z.string().default(""),
  runtime_name: nullableString,
  created_at: z.string().default(""),
  archived_at: nullableString,
  runs_30d: z.number().default(0),
});

export const adminAgentDetailSchema = adminAgentSchema.extend({
  description: z.string().default(""),
  model: nullableString,
  updated_at: z.string().default(""),
});

export const adminAgentPageSchema = pageSchema(adminAgentSchema);

export const adminRuntimeSchema = z.object({
  id: z.string(),
  workspace_id: z.string().default(""),
  workspace_name: z.string().default(""),
  workspace_slug: z.string().default(""),
  display_name: z.string().default(""),
  provider: z.string().default(""),
  status: z.string().default(""),
  last_seen_at: nullableString,
  created_at: z.string().default(""),
  owner_id: z.string().default(""),
  owner_name: nullableString,
  owner_email: nullableString,
  visibility: z.string().default(""),
  device_info: z.string().default(""),
});

export const adminRuntimeDetailSchema = adminRuntimeSchema.extend({
  task_count: z.number().default(0),
  active_task_count: z.number().default(0),
});

export const adminRuntimePageSchema = pageSchema(adminRuntimeSchema);

export const adminCountsSchema = z.object({
  users: z.number().default(0),
  workspaces: z.number().default(0),
  members: z.number().default(0),
  issues: z.number().default(0),
  agents: z.number().default(0),
  runtimes_online: z.number().default(0),
  runtimes_offline: z.number().default(0),
  tasks_active: z.number().default(0),
  tasks_failed_24h: z.number().default(0),
  tasks_24h: z.number().default(0),
});

export const adminUsageTotalsSchema = z.object({
  input_tokens: z.number().default(0),
  output_tokens: z.number().default(0),
  cache_read_tokens: z.number().default(0),
  cache_write_tokens: z.number().default(0),
  cost_usd_ticks: z.number().default(0),
  cost_usd: z.number().default(0),
  task_count: z.number().default(0),
});

const emptyCounts = {
  users: 0,
  workspaces: 0,
  members: 0,
  issues: 0,
  agents: 0,
  runtimes_online: 0,
  runtimes_offline: 0,
  tasks_active: 0,
  tasks_failed_24h: 0,
  tasks_24h: 0,
};

const emptyUsageTotals = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  cost_usd_ticks: 0,
  cost_usd: 0,
  task_count: 0,
};

export const adminOverviewSchema = z.object({
  counts: adminCountsSchema.default(emptyCounts),
  tasks_by_status: z
    .array(z.object({ status: z.string().default(""), count: z.number().default(0) }))
    .default([]),
  usage: adminUsageTotalsSchema.default(emptyUsageTotals),
  signups_daily: z
    .array(z.object({ day: z.string().default(""), count: z.number().default(0) }))
    .default([]),
  tasks_daily: z
    .array(
      z.object({
        day: z.string().default(""),
        completed: z.number().default(0),
        failed: z.number().default(0),
      }),
    )
    .default([]),
  generated_at: z.string().default(""),
});

export const adminUsageRowSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  workspace_id: z.string().default(""),
  workspace_name: z.string().default(""),
  workspace_slug: z.string().default(""),
  provider: z.string().default(""),
  model: z.string().default(""),
  input_tokens: z.number().default(0),
  output_tokens: z.number().default(0),
  cost_usd_ticks: z.number().default(0),
  cost_usd: z.number().default(0),
  task_count: nullableNumber,
});

export const adminUsageSchema = z.object({
  group_by: z.string().default("workspace"),
  from: z.string().default(""),
  to: z.string().default(""),
  totals: adminUsageTotalsSchema.default(emptyUsageTotals),
  rows: z.array(adminUsageRowSchema).default([]),
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminMembership = z.infer<typeof adminMembershipSchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminUserPage = z.infer<typeof adminUserPageSchema>;
export type AdminWorkspace = z.infer<typeof adminWorkspaceSchema>;
export type AdminWorkspaceMember = z.infer<typeof adminWorkspaceMemberSchema>;
export type AdminWorkspaceDetail = z.infer<typeof adminWorkspaceDetailSchema>;
export type AdminWorkspacePage = z.infer<typeof adminWorkspacePageSchema>;
export type AdminTask = z.infer<typeof adminTaskSchema>;
export type AdminTaskUsage = z.infer<typeof adminTaskUsageSchema>;
export type AdminTaskDetail = z.infer<typeof adminTaskDetailSchema>;
export type AdminTaskPage = z.infer<typeof adminTaskPageSchema>;
export type AdminAgent = z.infer<typeof adminAgentSchema>;
export type AdminAgentDetail = z.infer<typeof adminAgentDetailSchema>;
export type AdminAgentPage = z.infer<typeof adminAgentPageSchema>;
export type AdminRuntime = z.infer<typeof adminRuntimeSchema>;
export type AdminRuntimeDetail = z.infer<typeof adminRuntimeDetailSchema>;
export type AdminRuntimePage = z.infer<typeof adminRuntimePageSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type AdminUsage = z.infer<typeof adminUsageSchema>;
export type AdminUsageRow = z.infer<typeof adminUsageRowSchema>;
