import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSidebarSessionArea } from "@/features/chat/components/layout/chat-sidebar-desktop-layout";

function renderSessionArea(isProjectFirstView: boolean) {
  const onAddProject = vi.fn();
  const onSelectMode = vi.fn();

  render(
    <ChatSidebarSessionArea
      defaultSessionType="native"
      groups={[]}
      isCollapsed={false}
      isLoading={false}
      isProjectFirstView={isProjectFirstView}
      onAddProject={onAddProject}
      onSelectMode={onSelectMode}
      projectGroups={[]}
      renderSessionItem={() => <></>}
      sessionTypeOptions={[]}
    />,
  );

  return { onAddProject, onSelectMode };
}

describe("ChatSidebarSessionArea", () => {
  it("reserves the action-row height while switching list modes", () => {
    const { onSelectMode } = renderSessionArea(false);

    expect(
      screen.getByRole("button", { name: "Time" }).parentElement?.parentElement?.className,
    ).toContain("h-7");
    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(onSelectMode).toHaveBeenCalledWith("project-first");
  });

  it("uses a folder-plus icon for the add-project action", () => {
    const { onAddProject } = renderSessionArea(true);
    const addProjectButton = screen.getByRole("button", { name: "Add Project" });

    expect(
      addProjectButton
        .querySelector("svg")
        ?.classList.contains("lucide-folder-plus"),
    ).toBe(true);
    fireEvent.click(addProjectButton);

    expect(onAddProject).toHaveBeenCalledOnce();
  });
});
