import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkItemDrawer } from "./project-work-item-drawer";

const mocks = vi.hoisted(() => ({
  updateItem: vi.fn(),
  useProjectWorkItem: vi.fn(),
}));

vi.mock("@/features/projects/hooks/use-project-work", () => ({
  useProjectWork: () => ({
    data: { states: [{ id: "planned", name: "Planned" }] },
  }),
  useProjectWorkItem: mocks.useProjectWorkItem,
  useProjectWorkActivity: () => ({ data: { activities: [] } }),
  useProjectWorkActions: () => ({
    updateItem: { mutateAsync: mocks.updateItem, isPending: false },
    deleteItem: { mutateAsync: vi.fn() },
    restoreItem: { mutateAsync: vi.fn() },
    linkArtifact: { mutateAsync: vi.fn(), isPending: false },
    unlinkArtifact: { mutateAsync: vi.fn() },
  }),
}));

describe("ProjectWorkItemDrawer", () => {
  it("renders details in a right-side dialog and opens linked artifacts", () => {
    mocks.useProjectWorkItem.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: "work-1",
        projectId: "project-1",
        title: "Drawer details",
        description: "Durable details",
        stateId: "planned",
        state: { id: "planned", name: "Planned" },
        attention: "none",
        version: 1,
        deletedAt: null,
        artifacts: [
          { id: "artifact-1", path: "docs/design.md", label: "Design" },
        ],
      },
    });
    const onOpenArtifact = vi.fn();

    render(
      <ProjectWorkItemDrawer
        projectId="project-1"
        projectRoot="/tmp/project"
        workItemId="work-1"
        onOpenChange={vi.fn()}
        onOpenArtifact={onOpenArtifact}
      />,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByDisplayValue("Drawer details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(onOpenArtifact).toHaveBeenCalledWith(
      "/tmp/project/docs/design.md",
      "Design",
    );
  });
});
