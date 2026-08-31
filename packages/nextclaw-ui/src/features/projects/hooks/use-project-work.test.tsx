import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWork } from "./use-project-work";

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
    mocks.listWork.mockResolvedValue({ items: [], states: [], total: 0 });
  });

  it("refreshes the project query from committed work events only for the matching project", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(() => useProjectWork("project-1"), {
      wrapper,
    });
    await waitFor(() => expect(mocks.listWork).toHaveBeenCalledTimes(1));

    mocks.handler?.({ projectId: "project-2" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.listWork).toHaveBeenCalledTimes(1);

    mocks.handler?.({ projectId: "project-1", workItemId: "work-1" });
    await waitFor(() => expect(mocks.listWork).toHaveBeenCalledTimes(2));
    unmount();
    expect(mocks.handler).toBeNull();
  });
});
