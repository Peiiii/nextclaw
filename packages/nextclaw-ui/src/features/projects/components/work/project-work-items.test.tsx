import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkItems } from "./project-work-items";

const mocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  useProjectWork: vi.fn(),
}));

vi.mock("@/features/projects/hooks/use-project-work", () => ({
  sortProjectWorkStates: (states: unknown[]) => states,
  useProjectWork: mocks.useProjectWork,
  useProjectWorkActions: () => ({
    createItem: { mutateAsync: mocks.createItem, isPending: false },
    createState: { mutateAsync: vi.fn(), isPending: false },
    updateState: { mutateAsync: vi.fn(), isPending: false },
    deleteState: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const state = {
  id: "planned",
  projectId: "project-1",
  name: "Planned",
  category: "unstarted",
  position: 0,
  isDefault: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const item = {
  id: "work-1",
  projectId: "project-1",
  title: "Clickable work item",
  description: "",
  stateId: state.id,
  state,
  attention: "none",
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  deletedAt: null,
  artifacts: [],
};

describe("ProjectWorkItems", () => {
  it("opens the same work item detail from list and board cards", () => {
    mocks.useProjectWork.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [item], states: [state], total: 1 },
    });
    const onOpenWorkItem = vi.fn();
    render(
      <ProjectWorkItems
        projectId="project-1"
        onOpenWorkItem={onOpenWorkItem}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Clickable work item/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Board|看板/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Clickable work item/ }),
    );

    expect(onOpenWorkItem).toHaveBeenNthCalledWith(1, "work-1");
    expect(onOpenWorkItem).toHaveBeenNthCalledWith(2, "work-1");
  });

  it("creates a work item and immediately opens its drawer", async () => {
    mocks.useProjectWork.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [], states: [state], total: 0 },
    });
    mocks.createItem.mockResolvedValue(item);
    const onOpenWorkItem = vi.fn();
    render(
      <ProjectWorkItems
        projectId="project-1"
        onOpenWorkItem={onOpenWorkItem}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(/Add a work item|添加工作项/),
      { target: { value: "Clickable work item" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Create|创建/ }));

    await vi.waitFor(() =>
      expect(onOpenWorkItem).toHaveBeenCalledWith("work-1"),
    );
  });
});
