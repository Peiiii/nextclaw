import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSidebarSessionArea } from "@/features/chat/components/layout/chat-sidebar-desktop-layout";

function renderSessionArea(isProjectFirstView: boolean, onScrollNearEnd = vi.fn()) {
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
      onScrollNearEnd={onScrollNearEnd}
      onSelectMode={onSelectMode}
      projectGroups={[]}
      projectCronJobCountByRoot={new Map()}
      renderSessionItem={() => <></>}
      sessionTypeOptions={[]}
    />,
  );

  return { onAddProject, onScrollNearEnd, onSelectMode };
}

describe("ChatSidebarSessionArea", () => {
  it("renders an accessible animated segmented control for list modes", () => {
    const { onSelectMode } = renderSessionArea(false);
    const modeGroup = screen.getByRole("group", { name: "Session list view" });
    const timeButton = screen.getByRole("button", { name: "Time" });
    const projectButton = screen.getByRole("button", { name: "Project" });

    expect(modeGroup.className).toContain("h-7");
    expect(modeGroup.className).toContain("rounded-full");
    expect(modeGroup.className).toContain("bg-foreground/[0.04]");
    expect(modeGroup.className).not.toContain("border");
    expect(modeGroup.className).not.toContain("shadow-inner");
    const modeIndicator = modeGroup.querySelector("span[aria-hidden='true']");
    expect(modeIndicator?.className).toContain("rounded-full");
    expect(modeIndicator?.className).toContain("bg-gray-200/70");
    expect(modeIndicator?.className).not.toContain("shadow-");
    expect(modeIndicator?.className).not.toContain("ring-");
    expect(modeIndicator?.className).toContain("transition-transform");
    expect(timeButton.getAttribute("aria-pressed")).toBe("true");
    expect(projectButton.getAttribute("aria-pressed")).toBe("false");
    expect(timeButton.className).toContain("rounded-full");
    expect(projectButton.className).toContain("rounded-full");
    expect(timeButton.querySelector("svg")).not.toBeNull();
    expect(projectButton.querySelector("svg")).not.toBeNull();
    expect(modeGroup.parentElement?.className).toContain("justify-end");
    expect(modeGroup.parentElement?.className).toContain("h-8");
    expect(modeGroup.parentElement?.lastElementChild).toBe(modeGroup);

    fireEvent.click(projectButton);

    expect(onSelectMode).toHaveBeenCalledWith("project-first");
  });

  it("uses a folder-plus icon for the add-project action", () => {
    const { onAddProject } = renderSessionArea(true);
    const addProjectButton = screen.getByRole("button", {
      name: "Add Project",
    });
    const modeIndicator = screen
      .getByRole("group", { name: "Session list view" })
      .querySelector("span[aria-hidden='true']");

    expect(
      addProjectButton
        .querySelector("svg")
        ?.classList.contains("lucide-folder-plus"),
    ).toBe(true);
    expect(addProjectButton.className).toContain("hover:bg-gray-200/60");
    expect(modeIndicator?.className).toContain("translate-x-full");
    expect(modeIndicator?.className).toContain("motion-reduce:transition-none");
    expect(
      screen
        .getByRole("button", { name: "Project" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(modeIndicator?.parentElement?.previousElementSibling).toBe(
      addProjectButton,
    );
    fireEvent.click(addProjectButton);

    expect(onAddProject).toHaveBeenCalledOnce();
  });

  it("requests the next page before scrolling reaches the end", () => {
    const { onScrollNearEnd } = renderSessionArea(false);
    const scroller = document.querySelector(".overflow-y-auto") as HTMLDivElement;
    Object.defineProperties(scroller, {
      scrollHeight: { value: 2_000 },
      clientHeight: { value: 500 },
    });

    fireEvent.scroll(scroller, { target: { scrollTop: 1_000 } });

    expect(onScrollNearEnd).toHaveBeenCalledOnce();
  });
});
