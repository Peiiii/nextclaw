import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  ChatSidebarProjectGroups,
  type ChatSidebarProjectGroup,
} from "@/features/chat/features/session/components/chat-sidebar-project-groups";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  createSession: vi.fn(),
  removeProject: vi.fn(),
  toggleProjectCollapsed: vi.fn(),
  toggleProjectPinned: vi.fn(),
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatSessionListManager: mocks,
  }),
}));
vi.mock("@/shared/hooks/use-projects", () => ({
  useRemoveProject: () => ({
    mutateAsync: mocks.removeProject,
    isPending: false,
  }),
}));
vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => <div data-testid="confirm-dialog" />,
  }),
}));

const projectGroup: ChatSidebarProjectGroup = {
  projectId: "project-analysis",
  projectRoot: "/tmp/analysis-project",
  projectName: "analysis-project",
  items: [
    {
      session: {
        key: "session:analysis",
        createdAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T00:00:00.000Z",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      },
    },
  ],
  latestUpdatedAt: 1,
  isPinned: false,
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}

function renderProjectGroups(
  isPinned = false,
  group: ChatSidebarProjectGroup = projectGroup,
  initialPath = "/chat",
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ChatSidebarProjectGroups
        groups={[{ ...group, isPinned }]}
        projectCronJobCountByRoot={new Map([[projectGroup.projectRoot, 2]])}
        defaultSessionType="native"
        sessionTypeOptions={[
          { value: "native", label: "Native", icon: null, ready: true },
        ]}
        renderSessionItem={() => <div>Project session</div>}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("ChatSidebarProjectGroups", () => {
  beforeEach(() => {
    mocks.confirm.mockReset();
    mocks.confirm.mockResolvedValue(true);
    mocks.createSession.mockReset();
    mocks.removeProject.mockReset();
    mocks.removeProject.mockResolvedValue(undefined);
    mocks.toggleProjectCollapsed.mockReset();
    mocks.toggleProjectPinned.mockReset();
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        collapsedProjectRoots: [],
        selectedSessionKey: "session:current",
      },
    });
    mocks.toggleProjectCollapsed.mockImplementation((projectRoot: string) => {
      useChatSessionListStore.getState().setSnapshot({
        collapsedProjectRoots: [projectRoot],
      });
    });
  });

  it("keeps the project header as the full-width folder row and collapses its sessions", () => {
    const { container } = renderProjectGroups();

    const header = screen.getByLabelText("Collapse project");
    const projectLink = screen.getByRole("link", { name: "analysis-project" });
    const projectRow = projectLink.parentElement?.parentElement;
    expect(container.firstElementChild?.className).toBe("space-y-0.5");
    expect(projectRow?.className).toContain("h-8");
    expect(projectRow?.className).toContain("hover:bg-gray-200/60");
    const projectContent = projectLink.parentElement;
    expect(projectContent?.classList.contains("pr-14")).toBe(false);
    expect(projectContent?.className).toContain("group-hover/project:pr-20");
    expect(projectContent?.className).toContain(
      "group-has-[[data-project-actions]:focus-within]/project:pr-20",
    );
    expect(projectLink.querySelector("span")?.className).not.toContain(
      "uppercase",
    );
    expect(projectLink.querySelector("span")?.className).toContain(
      "text-[13px]",
    );
    expect(
      header.compareDocumentPosition(projectLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Sessions")).toBeNull();

    fireEvent.click(header);

    expect(mocks.toggleProjectCollapsed).toHaveBeenCalledWith(
      "/tmp/analysis-project",
    );
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe(
      "session:current",
    );
    expect(screen.queryByText("Project session")).toBeNull();
  });

  it("opens the project home from the project name without changing expansion", () => {
    renderProjectGroups();

    fireEvent.click(screen.getByRole("link", { name: "analysis-project" }));

    expect(mocks.toggleProjectCollapsed).not.toHaveBeenCalled();
    expect(screen.getByTestId("location").textContent).toBe(
      "/projects/project-analysis/overview",
    );
    expect(screen.getByText("Project session")).toBeTruthy();
  });

  it("surfaces a running child session while its project is collapsed", () => {
    renderProjectGroups(false, {
      ...projectGroup,
      items: [{ ...projectGroup.items[0], runStatus: "running" as const }],
    });

    expect(screen.queryByLabelText("Running")).toBeNull();

    fireEvent.click(screen.getByLabelText("Collapse project"));

    expect(screen.getByLabelText("Running")).toBeTruthy();
  });

  it("shows project context from the row on hover", async () => {
    const user = userEvent.setup();
    renderProjectGroups();

    await user.hover(screen.getByLabelText("Collapse project"));

    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("Path")).toBeTruthy();
    expect(within(tooltip).getByText("Sessions")).toBeTruthy();
    expect(within(tooltip).getByText("Scheduled tasks")).toBeTruthy();
    expect(within(tooltip).getByText("/tmp/analysis-project")).toBeTruthy();
    expect(within(tooltip).getByText("2")).toBeTruthy();
  });

  it("keeps project creation, pinning, and more actions in one trailing cluster", () => {
    renderProjectGroups();

    fireEvent.click(screen.getByLabelText("Pin project"));

    expect(mocks.toggleProjectPinned).toHaveBeenCalledWith(
      "/tmp/analysis-project",
    );
    expect(screen.getByLabelText("New Task · analysis-project")).not.toBeNull();
    const pinButton = screen.getByLabelText("Pin project");
    const moreButton = screen.getByLabelText(
      "More actions for analysis-project",
    );
    expect(
      pinButton.compareDocumentPosition(moreButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("removes a project from an ordinary more-actions menu after confirmation", async () => {
    const user = userEvent.setup();
    renderProjectGroups(
      false,
      projectGroup,
      "/projects/project-analysis/overview",
    );

    await user.click(
      screen.getByLabelText("More actions for analysis-project"),
    );
    const removeButton = await screen.findByRole("button", {
      name: "Remove from project list",
    });
    expect(removeButton.className).not.toContain("text-destructive");
    await user.click(removeButton);

    await vi.waitFor(() =>
      expect(mocks.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/local folder|本地目录/),
          variant: "default",
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(mocks.removeProject).toHaveBeenCalledWith("project-analysis"),
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/projects"),
    );
  });

  it("keeps the project when removal is cancelled from the menu", async () => {
    mocks.confirm.mockResolvedValue(false);
    const user = userEvent.setup();
    renderProjectGroups();

    await user.click(
      screen.getByLabelText("More actions for analysis-project"),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Remove from project list",
      }),
    );

    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
    expect(mocks.removeProject).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "analysis-project" })).toBeTruthy();
  });

  it("uses the same pin control to show and clear the project pin state", () => {
    renderProjectGroups(true);

    const unpinButton = screen.getByLabelText("Unpin project");
    const pinIcon = unpinButton.querySelector("svg");

    expect(pinIcon?.getAttribute("class")).toContain("fill-current");
    expect(pinIcon?.getAttribute("class")).toContain("text-foreground");
    expect(document.querySelectorAll("svg.fill-current")).toHaveLength(1);

    fireEvent.click(unpinButton);

    expect(mocks.toggleProjectPinned).toHaveBeenCalledWith(
      "/tmp/analysis-project",
    );
  });
});
