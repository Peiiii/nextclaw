import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useMarketplaceItems,
  useMarketplaceRecentItems,
} from "@/features/marketplace/hooks/use-marketplace";
import type { MarketplaceListView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  fetchMarketplaceItems: vi.fn(),
}));

vi.mock("@/shared/lib/api", async () => {
  const actual = await vi.importActual("@/shared/lib/api");
  return {
    ...(actual as object),
    fetchMarketplaceItems: mocks.fetchMarketplaceItems,
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
