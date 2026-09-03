import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectWorkState } from "@nextclaw/client-sdk";
import {
  sortProjectWorkStates,
  sortProjectWorkStatesForList,
  useProjectWork,
  useProjectWorkEvents,
} from "./use-project-work";

const mocks = vi.hoisted(() => ({
  handler: null as
    | null
    | ((event: { projectId: string; workItemId?: string }) => void),
  listWork: vi.fn(),
}));

vi.mock("@/shared/lib/api", () => ({
  nextclawClient: {
    projects: { listWork: mocks.listWork },
    eventBus: {
      on: (
        _key: unknown,
        handler: (event: { projectId: string; workItemId?: string }) => void,
      ) => {
        mocks.handler = handler;
        return () => {
          mocks.handler = null;
        };
      },
    },
  },
}));

describe("useProjectWork", () => {
  beforeEach(() => {
    mocks.listWork.mockReset();
    mocks.listWork.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
  });

  it("refreshes the project query from committed work events only for the matching project", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(
      () => {
        useProjectWorkEvents("project-1");
        return useProjectWork("project-1", { stateId: "planned", limit: 20 });
      },
      {
        wrapper,
      },
    );
    await waitFor(() => expect(mocks.listWork).toHaveBeenCalledTimes(1));

    mocks.handler?.({ projectId: "project-2" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.listWork).toHaveBeenCalledTimes(1);

    mocks.handler?.({ projectId: "project-1", workItemId: "work-1" });
    await waitFor(() => expect(mocks.listWork).toHaveBeenCalledTimes(2));
    unmount();
    expect(mocks.handler).toBeNull();
  });

  it("loads the next opaque cursor without changing the state-scoped query", async () => {
    mocks.listWork
      .mockResolvedValueOnce({
        items: [{ id: "one" }],
        nextCursor: "next",
        total: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: "two" }],
        nextCursor: null,
        total: 2,
      });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useProjectWork("project-1", { stateId: "planned", limit: 20 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => await result.current.fetchNextPage());

    expect(mocks.listWork).toHaveBeenNthCalledWith(1, "project-1", {
      stateId: "planned",
      limit: 20,
    });
    expect(mocks.listWork).toHaveBeenNthCalledWith(2, "project-1", {
      stateId: "planned",
      limit: 20,
      cursor: "next",
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });
});

describe("project work state ordering", () => {
  const state = (
    name: string,
    category: ProjectWorkState["category"],
    position: number,
  ): ProjectWorkState => ({
    id: name,
    projectId: "project-1",
    name,
    category,
    position,
    isDefault: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  const states = [
    state("Backlog", "backlog", 0),
    state("Planned", "unstarted", 1),
    state("In Progress", "started", 2),
    state("In Review", "started", 3),
    state("Awaiting Acceptance", "started", 4),
    state("Completed", "completed", 5),
    state("Canceled", "canceled", 6),
  ];

  it("surfaces active states closest to done in list view", () => {
    expect(
      sortProjectWorkStatesForList(states).map(({ name }) => name),
    ).toEqual([
      "Awaiting Acceptance",
      "In Review",
      "In Progress",
      "Planned",
      "Backlog",
      "Completed",
      "Canceled",
    ]);
  });

  it("keeps workflow order for board and state settings", () => {
    expect(sortProjectWorkStates(states).map(({ name }) => name)).toEqual([
      "Backlog",
      "Planned",
      "In Progress",
      "In Review",
      "Awaiting Acceptance",
      "Completed",
      "Canceled",
    ]);
  });
});
