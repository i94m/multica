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

const CSRF_HEADER = "X-CSRF-Token";
const CSRF_COOKIE = "multica_csrf";
const SESSION_CSRF_COOKIE = "multica_csrf_session";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// Cookie-authenticated writes need the CSRF header. Two values can be on
// offer: the session-bound one and the token-bound one (MUL-7436). Try the
// preferred value, and fall back to the other only when the server rejects it,
// so a rotated session cannot wedge the console.
function csrfCandidates(): string[] {
  const values = [readCookie(SESSION_CSRF_COOKIE), readCookie(CSRF_COOKIE)].filter(
    (value): value is string => !!value,
  );
  return Array.from(new Set(values));
}

async function send(
  path: string,
  method: string,
  body: unknown,
  csrf: string | null,
): Promise<Response> {
  const token = api.getToken();
  return fetch(`${api.getBaseUrl()}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(
  path: string,
  schema: z.ZodType,
  fallback: T,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const candidates: Array<string | null> = method === "GET" ? [null] : csrfCandidates();
  let response = await send(path, method, body, candidates[0] ?? null);
  if (response.status === 403 && method !== "GET" && candidates.length > 1) {
    const rejected = await response
      .clone()
      .text()
      .catch(() => "");
    if (rejected.includes("CSRF")) {
      response = await send(path, method, body, candidates[1] ?? null);
    }
  }
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
