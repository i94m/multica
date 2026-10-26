const encode = (id: string) => encodeURIComponent(id);

export const adminPaths = {
  root: () => "/admin",
  users: () => "/admin/users",
  user: (id: string) => `/admin/users/${encode(id)}`,
  workspaces: () => "/admin/workspaces",
  workspace: (id: string) => `/admin/workspaces/${encode(id)}`,
  tasks: () => "/admin/tasks",
  task: (id: string) => `/admin/tasks/${encode(id)}`,
  agents: () => "/admin/agents",
  agent: (id: string) => `/admin/agents/${encode(id)}`,
  runtimes: () => "/admin/runtimes",
  runtime: (id: string) => `/admin/runtimes/${encode(id)}`,
  usage: () => "/admin/usage",
};
