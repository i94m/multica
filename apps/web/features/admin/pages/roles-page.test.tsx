// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@multica/views/i18n", () => ({ useLocale: () => "en" }));

vi.mock("../i18n", () => ({
  useAdminCopy: () => ({
    common: { cancel: "Cancel", save: "Save", saving: "Saving", loading: "Loading" },
    roles: {
      title: "Roles",
      description: "",
      newRole: "New role",
      editRole: "Edit role",
      name: "Name",
      shortDescription: "Short description",
      instructions: "Role instructions",
      skills: "Skills",
      skillsFor: "Skills for {name}",
      skillsHint: "",
      noSkills: "No skills",
      skillCount: "Skills",
      agentCount: "Agents",
      empty: "No roles",
      saved: "Saved",
      saveFailed: "Failed",
      deleted: "Deleted",
      deleteFailed: "Failed",
      deleteTitle: "Delete?",
      deleteBody: "",
      skillsSaved: "Saved",
      skillsSaveFailed: "Failed",
    },
  }),
}));

vi.mock("../roles", () => ({
  rolesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    skills: vi.fn(),
    setSkills: vi.fn(),
    skillPool: vi.fn(),
  },
}));

import RolesPage from "./roles-page";
import { rolesApi } from "../roles";

const role = {
  id: "role-1",
  name: "Reviewer",
  description: "",
  instructions: "",
  agent_count: 0,
  skill_count: 1,
  created_at: "",
  updated_at: "",
};

const skillA = { id: "skill-a", name: "Skill A", description: "" };
const skillB = { id: "skill-b", name: "Skill B", description: "" };

function renderPage() {
  // The app's client keeps everything fresh forever; the test keeps that
  // setting so a missing invalidation fails here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RolesPage />
    </QueryClientProvider>,
  );
}

function checkboxes(): HTMLElement[] {
  return screen.getAllByRole("checkbox") as HTMLElement[];
}

function checkboxAt(index: number): HTMLElement {
  const element = checkboxes()[index];
  if (!element) throw new Error(`checkbox ${index} is not rendered`);
  return element;
}

describe("AdminRolesPage skill grants", () => {
  beforeEach(() => {
    // The server keeps the grant set; saving changes what the next read returns.
    let grants = [skillA.id];
    const byId = (id: string) => (id === skillA.id ? skillA : skillB);

    vi.mocked(rolesApi.list).mockResolvedValue({ roles: [role] });
    vi.mocked(rolesApi.skillPool).mockResolvedValue({ skills: [skillA, skillB] });
    vi.mocked(rolesApi.skills).mockImplementation(async () => ({
      skills: grants.map(byId),
    }));
    vi.mocked(rolesApi.setSkills).mockImplementation(async (_id, ids) => {
      grants = ids;
      return { skills: ids.map(byId) };
    });
  });

  it("shows the saved grant set when the dialog is reopened", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Reviewer");
    await user.click(await screen.findByRole("button", { name: /Skills/ }));
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    expect(checkboxAt(0)).toBeChecked();
    expect(checkboxAt(1)).not.toBeChecked();

    await user.click(checkboxAt(1));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(rolesApi.setSkills).toHaveBeenCalledWith("role-1", ["skill-a", "skill-b"]));

    await user.click(await screen.findByRole("button", { name: /Skills/ }));
    await waitFor(() => expect(checkboxes()).toHaveLength(2));
    expect(checkboxAt(0)).toBeChecked();
    expect(checkboxAt(1)).toBeChecked();
  });
});
