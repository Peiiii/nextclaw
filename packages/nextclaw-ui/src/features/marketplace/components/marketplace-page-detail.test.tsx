import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketplacePage } from "@/features/marketplace";
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
  docOpen: vi.fn(),
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
    open: mocks.docOpen,
  }),
}));

vi.mock("@/shared/lib/api", () => ({
  fetchMarketplaceSkillContent: mocks.fetchMarketplaceSkillContent,
  fetchMarketplacePluginContent: vi.fn(),
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
  useMarketplaceInstalled: () => mocks.installedQuery,
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
      pageSize: 12,
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
    mocks.docOpen.mockReset();
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

    expect(mocks.docOpen).toHaveBeenCalledTimes(1);
    expect(String(mocks.docOpen.mock.calls[0]?.[0])).toContain("Loading");
    expect(mocks.docOpen.mock.calls[0]?.[1]).toMatchObject({
      dedupeKey: "marketplace:skill:web-search",
      kind: "content",
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
      expect(mocks.docOpen).toHaveBeenCalledTimes(2);
    });
    expect(mocks.docOpen.mock.calls[1]?.[1]).toMatchObject({
      activate: false,
      dedupeKey: "marketplace:skill:web-search",
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
      expect(mocks.docOpen).toHaveBeenCalledTimes(4);
    });

    const webSearchCalls = mocks.docOpen.mock.calls.filter(
      (call) => call[1]?.dedupeKey === "marketplace:skill:web-search",
    );
    const browserCalls = mocks.docOpen.mock.calls.filter(
      (call) => call[1]?.dedupeKey === "marketplace:skill:bb-browser",
    );

    expect(webSearchCalls).toHaveLength(2);
    expect(browserCalls).toHaveLength(2);
    expect(String(webSearchCalls[1]?.[0])).toContain("Web%20Search");
    expect(String(browserCalls[1]?.[0])).toContain("BB%20Browser");
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
      expect(mocks.docOpen).toHaveBeenCalledTimes(3);
    });

    expect(String(mocks.docOpen.mock.calls[2]?.[0])).toContain(
      "Latest%20content",
    );
    expect(mocks.docOpen.mock.calls[2]?.[1]).toMatchObject({
      activate: false,
      dedupeKey: "marketplace:skill:web-search",
    });
    expect(String(mocks.docOpen.mock.calls[2]?.[0])).not.toContain("Stale");
  });
});
