// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SkillSummary } from "@multica/core/types";
import { I18nProvider } from "@multica/core/i18n/react";
import enCommon from "../../locales/en/common.json";
import enAgents from "../../locales/en/agents.json";
import { SkillPickerList } from "./skill-picker-list";

const TEST_RESOURCES = { en: { common: enCommon, agents: enAgents } };

function skill(overrides: Partial<SkillSummary> & Pick<SkillSummary, "id" | "name">): SkillSummary {
  return {
    workspace_id: "ws-1",
    scope: "workspace",
    description: "",
    config: {},
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SkillPickerList", () => {
  it("shows global skills but does not toggle them", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const globalSkill = skill({
      id: "global-1",
      name: "Platform baseline",
      scope: "global",
      description: "Applies everywhere",
    });
    const workspaceSkill = skill({ id: "workspace-1", name: "Review helper" });

    render(
      <I18nProvider locale="en" resources={TEST_RESOURCES}>
        <SkillPickerList
          skills={[globalSkill, workspaceSkill]}
          selectedIds={new Set()}
          onToggle={onToggle}
        />
      </I18nProvider>,
    );

    const globalRow = screen.getByRole("button", { name: /Platform baseline/i });
    expect(globalRow).toBeDisabled();
    expect(screen.getByText("Global")).toBeInTheDocument();

    await user.click(globalRow);
    expect(onToggle).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Review helper/i }));
    expect(onToggle).toHaveBeenCalledWith(workspaceSkill);
  });
});
