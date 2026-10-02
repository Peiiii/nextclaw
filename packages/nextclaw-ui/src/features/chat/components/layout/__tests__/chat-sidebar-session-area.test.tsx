import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSidebarSessionArea } from "@/features/chat/components/layout/chat-sidebar-desktop-layout";
import type { ChatSessionListMode } from '@/features/chat/stores/chat-session-list.store';

function renderSessionArea(listMode: ChatSessionListMode, onScrollNearEnd = vi.fn()) {
  const onAddProject = vi.fn();
  const onSelectMode = vi.fn();

  render(
    <ChatSidebarSessionArea
      query=""
      onQueryChange={vi.fn()}
      defaultSessionType="native"
      groups={[]}
      isCollapsed={false}
      isLoading={false}
      listMode={listMode}
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
  it('explains when scheduled conversations will appear', () => {
    renderSessionArea('scheduled');
    expect(screen.getByText('No scheduled task conversations yet. They will appear after a task runs.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scheduled' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Add Project' })).toBeNull();
  });

  it("renders an accessible segmented control for all three list modes", () => {
    const { onSelectMode } = renderSessionArea('time-first');
    const modeGroup = screen.getByRole("group", { name: "Session list view" });
    const timeButton = screen.getByRole("button", { name: "Time" });
    const projectButton = screen.getByRole("button", { name: "Project" });

    expect(modeGroup.className).toContain("h-7");
    expect(modeGroup.className).toContain("rounded-full");
    expect(modeGroup.className).toContain("bg-foreground/[0.04]");
    expect(modeGroup.className).not.toContain("border");
    expect(modeGroup.className).not.toContain("shadow-inner");
    const scheduledButton = screen.getByRole('button', { name: 'Scheduled' });
    expect(scheduledButton.getAttribute('aria-pressed')).toBe('false');
    expect(timeButton.className).toContain('bg-[var(--sidebar-segment-selection)]');
    expect(timeButton.getAttribute("aria-pressed")).toBe("true");
    expect(projectButton.getAttribute("aria-pressed")).toBe("false");
    expect(timeButton.className).toContain("rounded-full");
    expect(projectButton.className).toContain("rounded-full");
    expect(timeButton.querySelector("svg")).not.toBeNull();
    expect(projectButton.querySelector("svg")).not.toBeNull();
    expect(modeGroup.parentElement?.className).toContain("justify-between");
    expect(modeGroup.parentElement?.className).toContain("h-8");
    expect(modeGroup.parentElement?.firstElementChild).toBe(modeGroup);

    fireEvent.click(projectButton);

    expect(onSelectMode).toHaveBeenCalledWith("project-first");
    fireEvent.click(scheduledButton);
    expect(onSelectMode).toHaveBeenLastCalledWith('scheduled');
  });

  it("uses a folder-plus icon for the add-project action", () => {
    const { onAddProject } = renderSessionArea('project-first');
    const addProjectButton = screen.getByRole("button", {
      name: "Add Project",
    });

    expect(
      addProjectButton
        .querySelector("svg")
        ?.classList.contains("lucide-folder-plus"),
    ).toBe(true);
    expect(addProjectButton.className).toContain("hover:before:bg-[var(--interaction-hover)]");
    expect(screen.getByRole('button', { name: 'Project' }).className).toContain('bg-[var(--sidebar-segment-selection)]');
    expect(
      screen
        .getByRole("button", { name: "Project" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Search conversations..." }).previousElementSibling).toBe(
      addProjectButton,
    );
    fireEvent.click(addProjectButton);

    expect(onAddProject).toHaveBeenCalledOnce();
  });

  it("requests the next page before scrolling reaches the end", () => {
    const { onScrollNearEnd } = renderSessionArea('time-first');
    const scroller = document.querySelector(".overflow-y-auto") as HTMLDivElement;
    Object.defineProperties(scroller, {
      scrollHeight: { value: 2_000 },
      clientHeight: { value: 500 },
    });

    fireEvent.scroll(scroller, { target: { scrollTop: 1_000 } });

    expect(onScrollNearEnd).toHaveBeenCalledOnce();
  });
});
