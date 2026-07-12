import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSidebarProjectGroups } from "@/features/chat/features/session/components/chat-sidebar-project-groups";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  toggleProjectCollapsed: vi.fn(),
  toggleProjectPinned: vi.fn(),
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatSessionListManager: mocks,
  }),
}));

const projectGroup = {
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

function renderProjectGroups(isPinned = false) {
  return render(
    <ChatSidebarProjectGroups
      groups={[{ ...projectGroup, isPinned }]}
      defaultSessionType="native"
      sessionTypeOptions={[
        { value: "native", label: "Native", icon: null, ready: true },
      ]}
      renderSessionItem={() => <div>Project session</div>}
    />,
  );
}

describe("ChatSidebarProjectGroups", () => {
  beforeEach(() => {
    mocks.createSession.mockReset();
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
    renderProjectGroups();

    const header = screen.getByLabelText("Collapse project");
    expect(header.parentElement?.className).toContain("h-10");
    expect(header.parentElement?.className).toContain("hover:bg-gray-200/60");
    expect(header.parentElement?.className).not.toContain("focus-within:bg");
    expect(screen.getByText("analysis-project").nextElementSibling?.tagName).toBe("svg");

    fireEvent.click(header);

    expect(mocks.toggleProjectCollapsed).toHaveBeenCalledWith(
      "/tmp/analysis-project",
    );
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe(
      "session:current",
    );
    expect(screen.queryByText("Project session")).toBeNull();
  });

  it("keeps project creation and pinning in one trailing action cluster", () => {
    renderProjectGroups();

    fireEvent.click(screen.getByLabelText("Pin project"));

    expect(mocks.toggleProjectPinned).toHaveBeenCalledWith(
      "/tmp/analysis-project",
    );
    expect(screen.getByLabelText("New Task · analysis-project")).not.toBeNull();
  });

  it("uses the same pin control to show and clear the project pin state", () => {
    renderProjectGroups(true);

    const unpinButton = screen.getByLabelText("Unpin project");
    const pinIcon = unpinButton.querySelector("svg");

    expect(pinIcon?.getAttribute("class")).toContain("fill-primary");
    expect(document.querySelectorAll("svg.fill-primary")).toHaveLength(1);

    fireEvent.click(unpinButton);

    expect(mocks.toggleProjectPinned).toHaveBeenCalledWith(
      "/tmp/analysis-project",
    );
  });
});
