import { api } from "@multica/core/api";
import { parseWithFallback } from "@multica/core/api/schema";
import { useAuthStore } from "@multica/core/auth";
import type { ZodType } from "zod";
import {
  adminAgentDetailSchema,
  adminAgentPageSchema,
  adminMeSchema,
  adminOverviewSchema,
  adminRuntimeDetailSchema,
  adminRuntimePageSchema,
  adminTaskDetailSchema,
  adminTaskPageSchema,
  adminUsageSchema,
  adminUserDetailSchema,
  adminUserPageSchema,
  adminWorkspaceDetailSchema,
  adminWorkspacePageSchema,
  type AdminAgent,
  type AdminAgentDetail,
  type AdminAgentPage,
  type AdminMembership,
  type AdminOverview,
  type AdminRuntime,
  type AdminRuntimeDetail,
  type AdminRuntimePage,
  type AdminTask,
  type AdminTaskDetail,
  type AdminTaskPage,
  type AdminUsage,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserPage,
  type AdminWorkspace,
  type AdminWorkspaceDetail,
  type AdminWorkspacePage,
} from "./schemas";

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

type QueryValue = string | number | boolean | null | undefined;
export type AdminQuery = Record<string, QueryValue>;

function queryString(params?: AdminQuery): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function adminGet<T>(
  path: string,
  schema: ZodType,
  fallback: T,
  endpoint: string,
  params?: AdminQuery,
): Promise<T> {
  const token = api.getToken();
  const response = await fetch(`${api.getBaseUrl()}${path}${queryString(params)}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (response.status === 401 && useAuthStore.getState().user) {
    useAuthStore.getState().sessionExpired();
  }

  if (!response.ok) {
    let message = `Admin API error: ${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status line when the body is not JSON.
    }
    throw new AdminApiError(message, response.status);
  }

  const raw = (await response.json()) as unknown;
  return parseWithFallback(raw, schema, fallback, { endpoint });
}

const emptyPage = {
  items: [],
  next_cursor: null,
  has_more: false,
};

export const adminApi = {
  getMe: () =>
    adminGet("/api/admin/me", adminMeSchema, { is_admin: false }, "GET /api/admin/me"),

  getOverview: (params?: AdminQuery) =>
    adminGet<AdminOverview | null>(
      "/api/admin/overview",
      adminOverviewSchema,
      null,
      "GET /api/admin/overview",
      params,
    ),

  listUsers: (params?: AdminQuery) =>
    adminGet<AdminUserPage>(
      "/api/admin/users",
      adminUserPageSchema,
      emptyPage as AdminUserPage,
      "GET /api/admin/users",
      params,
    ),

  getUser: (id: string) =>
    adminGet<AdminUserDetail | null>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      adminUserDetailSchema,
      null,
      "GET /api/admin/users/{id}",
    ),

  listWorkspaces: (params?: AdminQuery) =>
    adminGet<AdminWorkspacePage>(
      "/api/admin/workspaces",
      adminWorkspacePageSchema,
      emptyPage as AdminWorkspacePage,
      "GET /api/admin/workspaces",
      params,
    ),

  getWorkspace: (id: string) =>
    adminGet<AdminWorkspaceDetail | null>(
      `/api/admin/workspaces/${encodeURIComponent(id)}`,
      adminWorkspaceDetailSchema,
      null,
      "GET /api/admin/workspaces/{id}",
    ),

  listTasks: (params?: AdminQuery) =>
    adminGet<AdminTaskPage>(
      "/api/admin/tasks",
      adminTaskPageSchema,
      emptyPage as AdminTaskPage,
      "GET /api/admin/tasks",
      params,
    ),

  getTask: (id: string) =>
    adminGet<AdminTaskDetail | null>(
      `/api/admin/tasks/${encodeURIComponent(id)}`,
      adminTaskDetailSchema,
      null,
      "GET /api/admin/tasks/{id}",
    ),

  listAgents: (params?: AdminQuery) =>
    adminGet<AdminAgentPage>(
      "/api/admin/agents",
      adminAgentPageSchema,
      emptyPage as AdminAgentPage,
      "GET /api/admin/agents",
      params,
    ),

  getAgent: (id: string) =>
    adminGet<AdminAgentDetail | null>(
      `/api/admin/agents/${encodeURIComponent(id)}`,
      adminAgentDetailSchema,
      null,
      "GET /api/admin/agents/{id}",
    ),

  listRuntimes: (params?: AdminQuery) =>
    adminGet<AdminRuntimePage>(
      "/api/admin/runtimes",
      adminRuntimePageSchema,
      emptyPage as AdminRuntimePage,
      "GET /api/admin/runtimes",
      params,
    ),

  getRuntime: (id: string) =>
    adminGet<AdminRuntimeDetail | null>(
      `/api/admin/runtimes/${encodeURIComponent(id)}`,
      adminRuntimeDetailSchema,
      null,
      "GET /api/admin/runtimes/{id}",
    ),

  getUsage: (params?: AdminQuery) =>
    adminGet<AdminUsage | null>(
      "/api/admin/usage",
      adminUsageSchema,
      null,
      "GET /api/admin/usage",
      params,
    ),
};

export type {
  AdminAgent,
  AdminAgentDetail,
  AdminAgentPage,
  AdminMembership,
  AdminOverview,
  AdminRuntime,
  AdminRuntimeDetail,
  AdminRuntimePage,
  AdminTask,
  AdminTaskDetail,
  AdminTaskPage,
  AdminUsage,
  AdminUser,
  AdminUserDetail,
  AdminUserPage,
  AdminWorkspace,
  AdminWorkspaceDetail,
  AdminWorkspacePage,
};
