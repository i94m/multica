import { describe, expect, it } from "vitest";
import { parseWithFallback } from "@multica/core/api/schema";
import {
  adminOverviewSchema,
  adminTaskPageSchema,
  adminTaskSchema,
  adminUserPageSchema,
  type AdminTask,
} from "./schemas";

describe("admin schemas", () => {
  it("fills defaults for a minimal user page", () => {
    const page = adminUserPageSchema.parse({ items: [{ id: "u1" }] });
    expect(page.next_cursor).toBeNull();
    expect(page.has_more).toBe(false);
    expect(page.items[0]?.email).toBe("");
    expect(page.items[0]?.workspace_count).toBe(0);
  });

  it("keeps unknown task statuses and optional fields", () => {
    const task = adminTaskSchema.parse({
      id: "t1",
      status: "a_new_status_from_the_future",
      workspace_id: "w1",
      agent_id: "a1",
      cost_usd: 0.25,
    });
    expect(task.status).toBe("a_new_status_from_the_future");
    expect(task.issue_title).toBeNull();
    expect(task.cost_usd).toBe(0.25);
  });

  it("returns the fallback for a malformed response", () => {
    const fallback = { items: [], next_cursor: null, has_more: false };
    const page = parseWithFallback(
      { items: "not-an-array" },
      adminTaskPageSchema,
      fallback as { items: AdminTask[]; next_cursor: string | null; has_more: boolean },
      { endpoint: "GET /api/admin/tasks" },
    );
    expect(page).toEqual(fallback);
  });

  it("fills overview counters", () => {
    const overview = adminOverviewSchema.parse({});
    expect(overview.counts.users).toBe(0);
    expect(overview.tasks_by_status).toEqual([]);
    expect(overview.usage.cost_usd).toBe(0);
  });
});
