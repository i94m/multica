// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@multica/core/api", () => ({
  api: { getBaseUrl: () => "", getToken: () => null },
}));

vi.mock("@multica/core/auth", () => ({
  useAuthStore: { getState: () => ({ user: null, sessionExpired: () => {} }) },
}));

import { rolesApi } from "./roles";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

describe("admin role writes", () => {
  beforeEach(() => {
    clearCookies();
    vi.restoreAllMocks();
  });

  // The console had only ever been read-only, so its fetch helper sent no CSRF
  // header and every write came back 403. Regression guard for that.
  it("echoes the session-bound CSRF cookie on a write", async () => {
    document.cookie = "multica_csrf_session=session-value";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ skills: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await rolesApi.setSkills("role-1", ["skill-1"]);

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBe("session-value");
  });

  it("falls back to the token-bound value when the session-bound one is rejected", async () => {
    document.cookie = "multica_csrf_session=stale";
    document.cookie = "multica_csrf=token-value";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: "CSRF validation failed" }, 403),
      )
      .mockResolvedValueOnce(jsonResponse({ skills: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await rolesApi.setSkills("role-1", []);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(retryHeaders["X-CSRF-Token"]).toBe("token-value");
  });

  it("sends no CSRF header on a read", async () => {
    document.cookie = "multica_csrf_session=session-value";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ roles: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await rolesApi.list();

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBeUndefined();
  });
});
