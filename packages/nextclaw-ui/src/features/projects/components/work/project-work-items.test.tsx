import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectWorkItems } from "./project-work-items";

const mocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  fetchNextPage: vi.fn(),
  states: null as unknown[] | null,
  useProjectWork: vi.fn(),
}));

vi.mock("@/features/projects/hooks/use-project-work", () => ({
  sortProjectWorkStates: (states: unknown[]) => states,
  sortProjectWorkStatesForList: (states: unknown[]) => states,
  useProjectWork: mocks.useProjectWork,
  useProjectWorkEvents: vi.fn(),
  useProjectWorkStates: () => ({
    isLoading: false,
    isError: false,
    data: mocks.states ?? [state],
  }),
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
  artifactCount: 0,
};

describe("ProjectWorkItems", () => {
  beforeEach(() => {
    mocks.states = null;
  });

  it("opens the same work item detail from list and board cards", () => {
    mocks.useProjectWork.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ items: [item], nextCursor: null, total: 1 }] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mocks.fetchNextPage,
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
      data: { pages: [{ items: [], nextCursor: null, total: 0 }] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mocks.fetchNextPage,
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

  it("collapses a state group and loads its next page independently", () => {
    mocks.fetchNextPage.mockReset();
    mocks.useProjectWork.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ items: [item], nextCursor: "next", total: 21 }] },
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mocks.fetchNextPage,
    });
    render(<ProjectWorkItems projectId="project-1" onOpenWorkItem={vi.fn()} />);

    const group = screen.getByRole("button", { name: /Planned.*21/ });
    const count = screen.getByText("21");
    expect(count.className).toContain("rounded-full");
    expect(count.className).toContain("tabular-nums");
    fireEvent.click(group);
    expect(group.textContent).toContain("21");
    expect(
      screen.queryByRole("button", { name: /Clickable work item/ }),
    ).toBeNull();
    fireEvent.click(group);
    fireEvent.click(screen.getByRole("button", { name: /Load more|加载更多/ }));

    expect(mocks.fetchNextPage).toHaveBeenCalledOnce();
    expect(mocks.useProjectWork).toHaveBeenCalledWith("project-1", {
      stateId: "planned",
      includeDeleted: false,
      limit: 20,
    });
  });

  it("gives board columns one bounded shared height with independent scrolling", () => {
    mocks.useProjectWork.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ items: [item], nextCursor: null, total: 1 }] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mocks.fetchNextPage,
    });
    render(<ProjectWorkItems projectId="project-1" onOpenWorkItem={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Board|看板/ }));

    const group = screen.getByRole("region", { name: /Planned|计划中/ });
    expect(group.className).toContain("h-full");
    const cards = screen.getByRole("button", {
      name: /Clickable work item/,
    }).parentElement;
    expect(cards?.className).toContain("overflow-y-auto");
    expect(group.parentElement?.className).toContain("h-[calc(100dvh-17rem)]");
    expect(group.parentElement?.className).toContain("max-h-[52rem]");
  });

  it("encodes workflow state with shape, progress, and restrained color", () => {
    mocks.states = [
      {
        ...state,
        id: "backlog",
        name: "Ideas",
        category: "backlog",
        position: 0,
      },
      {
        ...state,
        id: "todo",
        name: "Ready",
        category: "unstarted",
        position: 1,
      },
      {
        ...state,
        id: "progress",
        name: "Building",
        category: "started",
        position: 2,
      },
      {
        ...state,
        id: "review",
        name: "Reviewing",
        category: "started",
        position: 3,
      },
      {
        ...state,
        id: "acceptance",
        name: "Accepting",
        category: "started",
        position: 4,
      },
      {
        ...state,
        id: "done",
        name: "Shipped",
        category: "completed",
        position: 5,
      },
      {
        ...state,
        id: "canceled",
        name: "Stopped",
        category: "canceled",
        position: 6,
      },
    ];
    mocks.useProjectWork.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pages: [{ items: [], nextCursor: null, total: 0 }] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mocks.fetchNextPage,
    });
    render(<ProjectWorkItems projectId="project-1" onOpenWorkItem={vi.fn()} />);

    const visualFor = (name: string) =>
      screen
        .getByRole("button", { name: new RegExp(`${name}.*0`) })
        .querySelector<HTMLElement>("[data-state-visual]");
    expect(visualFor("Ideas")?.dataset.stateVisual).toBe("backlog");
    expect(visualFor("Ready")?.dataset.stateVisual).toBe("unstarted");
    expect(visualFor("Building")?.className).toContain("text-amber-500");
    expect(
      visualFor("Building")
        ?.querySelectorAll("circle")[1]
        ?.getAttribute("stroke-dasharray"),
    ).toBe("25 75");
    expect(visualFor("Reviewing")?.className).toContain("text-orange-500");
    expect(
      visualFor("Reviewing")
        ?.querySelectorAll("circle")[1]
        ?.getAttribute("stroke-dasharray"),
    ).toBe("50 50");
    expect(visualFor("Accepting")?.className).toContain("text-emerald-600");
    expect(
      visualFor("Accepting")
        ?.querySelectorAll("circle")[1]
        ?.getAttribute("stroke-dasharray"),
    ).toBe("75 25");
    expect(visualFor("Shipped")?.dataset.stateVisual).toBe("completed");
    expect(visualFor("Stopped")?.dataset.stateVisual).toBe("canceled");
  });
});
