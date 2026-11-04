import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { Agent } from "@multica/core/types";
import { renderWithI18n } from "../../test/i18n";
import { AgentDetailInspector } from "./agent-detail-inspector";

vi.mock("@multica/core/hooks", () => ({ useWorkspaceId: () => "ws-1" }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ data: undefined, isSuccess: false }),
}));

vi.mock("../../common/avatar-upload-control", () => ({
  AvatarUploadControl: () => <div data-testid="avatar-upload" />,
}));

vi.mock("./inspector/model-picker", () => ({
  ModelPicker: () => <div data-testid="model-picker" />,
}));

vi.mock("./inspector/runtime-picker", () => ({
  RuntimePicker: () => <div data-testid="runtime-picker" />,
}));

vi.mock("./inspector/thinking-prop-row", () => ({
  ThinkingSettingField: () => <div data-testid="thinking-field" />,
}));

vi.mock("./inspector/service-tier-setting-field", () => ({
  ServiceTierSettingField: () => <div data-testid="service-tier-field" />,
}));

const agent = {
  id: "agent-1",
  workspace_id: "ws-1",
  name: "Agent",
  description: "",
  instructions: "",
  role_id: "",
  avatar_url: null,
  model: "",
  runtime_id: "runtime-1",
  runtime_mode: "cloud",
  runtime_config: {},
  max_concurrent_tasks: 1,
  owner_id: "user-1",
  visibility: "workspace",
  permission_mode: "public_to",
  thinking_level: "",
  service_tier: "",
  conversation_starters: [],
  skills: [],
  labels: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
} as unknown as Agent;

afterEach(cleanup);

// The create form collects a role and instructions; the settings form used to
// omit both, so an existing agent could never be re-pointed at a role.
describe("AgentDetailInspector role and instructions", () => {
  it("shows the role selector and the instructions editor", async () => {
    renderWithI18n(
      <AgentDetailInspector
        agent={agent}
        runtime={null}
        runtimes={[]}
        members={[]}
        currentUserId="user-1"
        canEdit
        onUpdate={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText("Role and instructions")).toBeInTheDocument();
    expect(screen.getByLabelText("Instructions")).toBeInTheDocument();
    // The role select renders its no-role label with no roles loaded.
    expect(screen.getByText("No role")).toBeInTheDocument();
  });

  it("saves role and instructions together", async () => {
    const onUpdate = vi.fn(async () => {});
    renderWithI18n(
      <AgentDetailInspector
        agent={agent}
        runtime={null}
        runtimes={[]}
        members={[]}
        currentUserId="user-1"
        canEdit
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Focus on tests." },
    });
    fireEvent.blur(screen.getByLabelText("Instructions"));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        agent.id,
        expect.objectContaining({
          instructions: "Focus on tests.",
          role_id: null,
        }),
      );
    });
  });
});
