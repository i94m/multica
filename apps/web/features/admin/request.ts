import { api } from "@multica/core/api";
import { parseWithFallback } from "@multica/core/api/schema";
import { useAuthStore } from "@multica/core/auth";
import type { ZodType } from "zod";
import { AdminApiError } from "./api";

// Shared transport for the console's write endpoints. The read endpoints use
// adminGet in api.ts; writes live in their own modules (roles, global skills)
// and need the CSRF header that cookie-authenticated mutations require.

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

export async function adminRequest<T>(
  path: string,
  schema: ZodType,
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
