// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill, SkillSummary } from "@multica/core/types";
import { I18nProvider } from "@multica/core/i18n/react";
import enCommon from "../../locales/en/common.json";
import enSkills from "../../locales/en/skills.json";

const TEST_RESOURCES = { en: { common: enCommon, skills: enSkills } };

vi.mock("@multica/core/api", () => ({
  api: { setSkillScope: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from "@multica/core/api";
import { toast } from "sonner";
import { GlobalSkillScopeDialog } from "./global-skill-scope-dialog";

const setSkillScope = vi.mocked(api.setSkillScope);

function makeSkill(scope: "workspace" | "global"): Skill {
  const summary: SkillSummary = {
    id: "skill-1",
    workspace_id: scope === "global" ? "" : "ws-1",
    scope,
    name: "release-notes",
    description: "",
    config: {},
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  return { ...summary, content: "# Release notes", files: [] };
}

function renderDialog(skill: Skill) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <I18nProvider locale="en" resources={TEST_RESOURCES}>
      <QueryClientProvider client={queryClient}>
        <GlobalSkillScopeDialog
          skill={skill}
          wsId="ws-1"
          open
          onOpenChange={() => {}}
        />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GlobalSkillScopeDialog", () => {
  it("promotes a workspace skill to global", async () => {
    setSkillScope.mockResolvedValue(makeSkill("global"));
    renderDialog(makeSkill("workspace"));

    expect(
      await screen.findByText("Make this skill global?"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Make global" }));

    await waitFor(() =>
      expect(setSkillScope).toHaveBeenCalledWith("skill-1", "global"),
    );
    expect(toast.success).toHaveBeenCalledWith("Skill is now global");
  });

  it("moves a global skill back to the current workspace", async () => {
    setSkillScope.mockResolvedValue(makeSkill("workspace"));
    renderDialog(makeSkill("global"));

    expect(
      await screen.findByText("Move this skill to the current workspace?"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Move to workspace" }),
    );

    await waitFor(() =>
      expect(setSkillScope).toHaveBeenCalledWith("skill-1", "workspace"),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Skill moved to this workspace",
    );
  });
});
