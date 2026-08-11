import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useManageMarketplaceItem,
  useMarketplaceItems,
  useMarketplaceRecentItems,
} from "@/features/marketplace/hooks/use-marketplace";
import { NextClawClientError } from "@nextclaw/client-sdk";
import type { MarketplaceListView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  fetchMarketplaceItems: vi.fn(),
  manageMarketplaceItem: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}));

vi.mock("@/shared/lib/api", async () => {
  const actual = await vi.importActual("@/shared/lib/api");
  return {
    ...(actual as object),
    fetchMarketplaceItems: mocks.fetchMarketplaceItems,
    manageMarketplaceItem: mocks.manageMarketplaceItem,
  };
});

function createMarketplaceList(name: string): MarketplaceListView {
  return {
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    sort: "relevance",
    items: [
      {
        id: name,
        slug: name,
        type: "skill",
        name,
        summary: name,
        summaryI18n: { en: name },
        tags: [],
        author: "NextClaw",
        install: {
          kind: "marketplace",
          spec: `@nextclaw/${name}`,
          command: `nextclaw skills install @nextclaw/${name}`,
        },
        updatedAt: "2026-06-08T00:00:00.000Z",
      },
    ],
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useMarketplaceItems", () => {
  beforeEach(() => {
    mocks.fetchMarketplaceItems.mockReset();
  });

  it("keeps previous marketplace items while search results refresh", async () => {
    let resolveSearch:
      | ((value: MarketplaceListView) => void)
      | undefined;
    mocks.fetchMarketplaceItems
      .mockResolvedValueOnce(createMarketplaceList("Initial Skill"))
      .mockReturnValueOnce(
        new Promise<MarketplaceListView>((resolve) => {
          resolveSearch = resolve;
        }),
      );

    const { result, rerender } = renderHook(
      ({ q }: { q?: string }) =>
        useMarketplaceItems({
          type: "skill",
          q,
          sort: "relevance",
          pageSize: 20,
        }),
      {
        initialProps: {},
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.data?.items[0]?.name).toBe("Initial Skill");
    });

    rerender({ q: "search" });

    expect(result.current.data?.items[0]?.name).toBe("Initial Skill");
    expect(result.current.isFetching).toBe(true);

    resolveSearch?.(createMarketplaceList("Search Skill"));

    await waitFor(() => {
      expect(result.current.data?.items[0]?.name).toBe("Search Skill");
    });
  });

  it("loads the recently updated shelf from its own updated query", async () => {
    mocks.fetchMarketplaceItems.mockResolvedValueOnce(
      createMarketplaceList("Recently Updated Skill"),
    );

    const { result } = renderHook(() => useMarketplaceRecentItems("skill"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.items[0]?.name).toBe(
        "Recently Updated Skill",
      );
    });
    expect(mocks.fetchMarketplaceItems).toHaveBeenCalledWith({
      type: "skill",
      sort: "updated",
      page: 1,
      pageSize: 6,
    });
  });
});

describe("useManageMarketplaceItem", () => {
  beforeEach(() => {
    mocks.manageMarketplaceItem.mockReset();
    mocks.toastError.mockReset();
  });

  it("leaves local-change conflicts for the explicit overwrite confirmation", async () => {
    const conflict = new NextClawClientError({
      message: "Local skill files changed since install: web-search",
      status: 409,
      code: "MARKETPLACE_SKILL_LOCAL_CHANGES",
    });
    mocks.manageMarketplaceItem.mockRejectedValueOnce(conflict);

    const { result } = renderHook(() => useManageMarketplaceItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        type: "skill",
        action: "update",
        id: "web-search",
        spec: "web-search",
      })).rejects.toBe(conflict);
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
