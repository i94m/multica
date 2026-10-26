import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { adminApi, type AdminQuery } from "./api";

export const adminKeys = {
  all: () => ["admin"] as const,
  me: () => [...adminKeys.all(), "me"] as const,
  overview: (params: AdminQuery) => [...adminKeys.all(), "overview", params] as const,
  users: (params: AdminQuery) => [...adminKeys.all(), "users", params] as const,
  user: (id: string) => [...adminKeys.all(), "user", id] as const,
  workspaces: (params: AdminQuery) => [...adminKeys.all(), "workspaces", params] as const,
  workspace: (id: string) => [...adminKeys.all(), "workspace", id] as const,
  tasks: (params: AdminQuery) => [...adminKeys.all(), "tasks", params] as const,
  task: (id: string) => [...adminKeys.all(), "task", id] as const,
  agents: (params: AdminQuery) => [...adminKeys.all(), "agents", params] as const,
  agent: (id: string) => [...adminKeys.all(), "agent", id] as const,
  runtimes: (params: AdminQuery) => [...adminKeys.all(), "runtimes", params] as const,
  runtime: (id: string) => [...adminKeys.all(), "runtime", id] as const,
  usage: (params: AdminQuery) => [...adminKeys.all(), "usage", params] as const,
};

export function adminMeOptions() {
  return queryOptions({
    queryKey: adminKeys.me(),
    queryFn: () => adminApi.getMe(),
    retry: false,
    staleTime: 60_000,
  });
}

export function adminOverviewOptions(params: AdminQuery = {}) {
  return queryOptions({
    queryKey: adminKeys.overview(params),
    queryFn: () => adminApi.getOverview(params),
    staleTime: 30_000,
  });
}

export function adminUsersOptions(params: AdminQuery) {
  return infiniteQueryOptions({
    queryKey: adminKeys.users(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => adminApi.listUsers({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : null),
    staleTime: 30_000,
  });
}

export function adminUserOptions(id: string) {
  return queryOptions({
    queryKey: adminKeys.user(id),
    queryFn: () => adminApi.getUser(id),
    enabled: id.length > 0,
    retry: false,
  });
}

export function adminWorkspacesOptions(params: AdminQuery) {
  return infiniteQueryOptions({
    queryKey: adminKeys.workspaces(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => adminApi.listWorkspaces({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : null),
    staleTime: 30_000,
  });
}

export function adminWorkspaceOptions(id: string) {
  return queryOptions({
    queryKey: adminKeys.workspace(id),
    queryFn: () => adminApi.getWorkspace(id),
    enabled: id.length > 0,
    retry: false,
  });
}

export function adminTasksOptions(params: AdminQuery) {
  return infiniteQueryOptions({
    queryKey: adminKeys.tasks(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => adminApi.listTasks({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : null),
    staleTime: 15_000,
  });
}

export function adminTaskOptions(id: string) {
  return queryOptions({
    queryKey: adminKeys.task(id),
    queryFn: () => adminApi.getTask(id),
    enabled: id.length > 0,
    retry: false,
  });
}

export function adminAgentsOptions(params: AdminQuery) {
  return infiniteQueryOptions({
    queryKey: adminKeys.agents(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => adminApi.listAgents({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : null),
    staleTime: 30_000,
  });
}

export function adminAgentOptions(id: string) {
  return queryOptions({
    queryKey: adminKeys.agent(id),
    queryFn: () => adminApi.getAgent(id),
    enabled: id.length > 0,
    retry: false,
  });
}

export function adminRuntimesOptions(params: AdminQuery) {
  return infiniteQueryOptions({
    queryKey: adminKeys.runtimes(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => adminApi.listRuntimes({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : null),
    staleTime: 15_000,
  });
}

export function adminRuntimeOptions(id: string) {
  return queryOptions({
    queryKey: adminKeys.runtime(id),
    queryFn: () => adminApi.getRuntime(id),
    enabled: id.length > 0,
    retry: false,
  });
}

export function adminUsageOptions(params: AdminQuery) {
  return queryOptions({
    queryKey: adminKeys.usage(params),
    queryFn: () => adminApi.getUsage(params),
    staleTime: 60_000,
  });
}
