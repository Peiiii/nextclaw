import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketplacePage } from "@/features/marketplace";
import { useMarketplaceDetailDocStore } from "@/features/marketplace/stores/marketplace-detail-doc.store";
import type { MarketplaceInstalledView, MarketplaceItemSummary, MarketplaceListView } from "@/shared/lib/api";

type ItemsQueryState = {
  data?: MarketplaceListView;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
};

type InstalledQueryState = {
  data?: MarketplaceInstalledView;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
};

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  docOpenTarget: vi.fn(),
  itemsQuery: null as unknown as ItemsQueryState,
  installedQuery: null as unknown as InstalledQueryState,
  fetchMarketplaceSkillContent: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...(actual as object),
    useNavigate: () => mocks.navigate,
    useParams: () => ({}),
  };
});

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    openTarget: mocks.docOpenTarget,
  }),
}));

vi.mock("@/shared/lib/api", () => ({
  fetchMarketplaceSkillContent: mocks.fetchMarketplaceSkillContent,
}));

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({
    language: "en",
  }),
}));

vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    ConfirmDialog: () => null,
  }),
}));

vi.mock("@/features/marketplace/hooks/use-marketplace", () => ({
  useMarketplaceItems: () => mocks.itemsQuery,
  useMarketplaceRecentItems: () => mocks.itemsQuery,
  useMarketplaceInstalled: () => mocks.installedQuery,
  useMarketplaceSkillScenes: () => ({
    data: { scenes: [] },
    isLoading: false,
  }),
  useMarketplaceSkillSceneCounts: () => new Map(),
  useInstallMarketplaceItem: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
  useManageMarketplaceItem: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
}));

function createMarketplaceItem(
  overrides: Partial<MarketplaceItemSummary> = {},
): MarketplaceItemSummary {
  return {
    id: "skill-web-search",
    slug: "web-search",
    type: "skill",
    name: "Web Search",
    summary: "Search the web from the marketplace",
    summaryI18n: { en: "Search the web from the marketplace" },
    tags: ["search"],
    author: "NextClaw",
    install: {
      kind: "marketplace",
      spec: "@nextclaw/web-search",
      command: "nextclaw skills install @nextclaw/web-search",
    },
    updatedAt: "2026-03-17T00:00:00.000Z",
    ...overrides,
  };
}

function createItemsQuery(items: MarketplaceItemSummary[]): ItemsQueryState {
  return {
    data: {
      total: items.length,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      sort: "relevance",
      items,
    } satisfies MarketplaceListView,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  };
}

function createInstalledQuery(): InstalledQueryState {
  return {
    data: {
      type: "skill",
      total: 0,
      specs: [],
      records: [],
    } satisfies MarketplaceInstalledView,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  };
}

describe("MarketplacePage detail loading", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.docOpenTarget.mockReset();
    mocks.fetchMarketplaceSkillContent.mockReset();
    mocks.itemsQuery = createItemsQuery([createMarketplaceItem()]);
    mocks.installedQuery = createInstalledQuery();
  });

  it("opens a loading detail immediately before skill content resolves", async () => {
    const user = userEvent.setup();
    let resolveContent:
      | ((value: {
          metadataRaw: string;
          bodyRaw: string;
          raw: string;
          source: string;
          sourceUrl: string;
        }) => void)
      | undefined;
    mocks.fetchMarketplaceSkillContent.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveContent = resolve;
        }),
    );

    render(<MarketplacePage forcedType="skills" />);

    await user.click(screen.getByText("Web Search"));

    expect(mocks.docOpenTarget).toHaveBeenCalledTimes(1);
    expect(mocks.docOpenTarget.mock.calls[0]?.[0]).toMatchObject({
      dedupeKey: "marketplace-detail:skill:web-search",
      kind: "marketplace-detail",
      title: "Web Search",
      url: "nextclaw://marketplace-detail/skill%3Aweb-search",
    });
    expect(useMarketplaceDetailDocStore.getState().entries["skill:web-search"]).toMatchObject({
      status: "loading",
      title: "Web Search",
    });

    resolveContent?.({
      metadataRaw: "name: Web Search",
      bodyRaw: "Use this skill to search the web.",
      raw: "Use this skill to search the web.",
      source: "marketplace",
      sourceUrl: "https://example.com/web-search",
    });

    await waitFor(() => {
      expect(mocks.docOpenTarget).toHaveBeenCalledTimes(2);
    });
    expect(mocks.docOpenTarget.mock.calls[1]?.[1]).toMatchObject({
      activate: false,
      dedupeKey: "marketplace-detail:skill:web-search",
    });
    expect(useMarketplaceDetailDocStore.getState().entries["skill:web-search"]).toMatchObject({
      contentRaw: "Use this skill to search the web.",
      status: "ready",
    });
  });

  it("keeps different skill detail responses independent", async () => {
    const user = userEvent.setup();
    let resolveFirst:
      | ((value: {
          metadataRaw: string;
          bodyRaw: string;
          raw: string;
          source: string;
          sourceUrl: string;
        }) => void)
      | undefined;
    let resolveSecond:
      | ((value: {
          metadataRaw: string;
          bodyRaw: string;
          raw: string;
          source: string;
          sourceUrl: string;
        }) => void)
      | undefined;
    mocks.fetchMarketplaceSkillContent.mockImplementation(
      (slug: string) =>
        new Promise((resolve) => {
          if (slug === "web-search") {
            resolveFirst = resolve;
            return;
          }
          resolveSecond = resolve;
        }),
    );
    mocks.itemsQuery = createItemsQuery([
      createMarketplaceItem(),
      createMarketplaceItem({
        id: "skill-browser",
        slug: "bb-browser",
        name: "BB Browser",
        summary: "Inspect pages in a browser workflow",
        summaryI18n: { en: "Inspect pages in a browser workflow" },
        install: {
          kind: "marketplace",
          spec: "@nextclaw/bb-browser",
          command: "nextclaw skills install @nextclaw/bb-browser",
        },
      }),
    ]);

    render(<MarketplacePage forcedType="skills" />);

    await user.click(screen.getByText("Web Search"));
    await user.click(screen.getByText("BB Browser"));

    resolveFirst?.({
      metadataRaw: "name: Web Search",
      bodyRaw: "Use this skill to search the web.",
      raw: "Use this skill to search the web.",
      source: "marketplace",
      sourceUrl: "https://example.com/web-search",
    });
    resolveSecond?.({
      metadataRaw: "name: BB Browser",
      bodyRaw: "Inspect pages in a browser workflow.",
      raw: "Inspect pages in a browser workflow.",
      source: "marketplace",
      sourceUrl: "https://example.com/bb-browser",
    });

    await waitFor(() => {
      expect(mocks.docOpenTarget).toHaveBeenCalledTimes(4);
    });

    const webSearchCalls = mocks.docOpenTarget.mock.calls.filter(
      (call) => call[0]?.dedupeKey === "marketplace-detail:skill:web-search",
    );
    const browserCalls = mocks.docOpenTarget.mock.calls.filter(
      (call) => call[0]?.dedupeKey === "marketplace-detail:skill:bb-browser",
    );

    expect(webSearchCalls).toHaveLength(2);
    expect(browserCalls).toHaveLength(2);
    expect(useMarketplaceDetailDocStore.getState().entries["skill:web-search"]?.contentRaw).toContain("search the web");
    expect(useMarketplaceDetailDocStore.getState().entries["skill:bb-browser"]?.contentRaw).toContain("browser workflow");
  });

  it("ignores stale responses for the same skill detail key", async () => {
    const user = userEvent.setup();
    let resolveFirst:
      | ((value: {
          metadataRaw: string;
          bodyRaw: string;
          raw: string;
          source: string;
          sourceUrl: string;
        }) => void)
      | undefined;
    let resolveSecond:
      | ((value: {
          metadataRaw: string;
          bodyRaw: string;
          raw: string;
          source: string;
          sourceUrl: string;
        }) => void)
      | undefined;
    mocks.fetchMarketplaceSkillContent.mockImplementation(
      () =>
        new Promise((resolve) => {
          if (!resolveFirst) {
            resolveFirst = resolve;
            return;
          }
          resolveSecond = resolve;
        }),
    );

    render(<MarketplacePage forcedType="skills" />);

    await user.click(screen.getByText("Web Search"));
    await user.click(screen.getByText("Web Search"));

    resolveFirst?.({
      metadataRaw: "name: stale",
      bodyRaw: "Stale content should not open.",
      raw: "Stale content should not open.",
      source: "marketplace",
      sourceUrl: "https://example.com/stale",
    });
    resolveSecond?.({
      metadataRaw: "name: Web Search",
      bodyRaw: "Latest content should open.",
      raw: "Latest content should open.",
      source: "marketplace",
      sourceUrl: "https://example.com/web-search",
    });

    await waitFor(() => {
      expect(mocks.docOpenTarget).toHaveBeenCalledTimes(3);
    });

    expect(useMarketplaceDetailDocStore.getState().entries["skill:web-search"]?.contentRaw).toContain(
      "Latest content",
    );
    expect(mocks.docOpenTarget.mock.calls[2]?.[1]).toMatchObject({
      activate: false,
      dedupeKey: "marketplace-detail:skill:web-search",
    });
    expect(useMarketplaceDetailDocStore.getState().entries["skill:web-search"]?.contentRaw).not.toContain("Stale");
  });
});
