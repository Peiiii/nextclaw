import { fireEvent, render, screen } from "@testing-library/react";
import { MarketplacePage } from "@/features/marketplace";
import type {
  MarketplaceInstalledView,
  MarketplaceItemSummary,
  MarketplaceListView,
} from "@/shared/lib/api";

type ItemsQueryState = {
  data?: MarketplaceListView;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: Error | null;
  hasNextPage: boolean;
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
  confirm: vi.fn(),
  openExternalUrl: vi.fn(),
  routeParams: {} as { scene?: string },
  itemsQuery: null as unknown as ItemsQueryState,
  installedQuery: null as unknown as InstalledQueryState,
  installMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  },
  manageMutation: {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...(actual as object),
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.routeParams,
  };
});

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen,
    openTarget: mocks.docOpen,
  }),
}));

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({
    language: "en",
  }),
}));

vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => null,
  }),
}));

vi.mock("@/shared/lib/host-capabilities", () => ({
  hostCapabilityManager: {
    openExternalUrl: mocks.openExternalUrl,
  },
}));

vi.mock("@/features/marketplace/hooks/use-marketplace", () => ({
  useMarketplaceItems: () => mocks.itemsQuery,
  useMarketplaceSkillScenes: () => ({
    data: {
      scenes: [
        {
          scene: "development-debugging",
          title: "Development",
          description: "Review, debug, analyze, and verify delivery work.",
          count: 2,
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useMarketplaceSkillSceneCounts: () => new Map([["development-debugging", 2]]),
  useMarketplaceInstalled: () => mocks.installedQuery,
  useInstallMarketplaceItem: () => mocks.installMutation,
  useManageMarketplaceItem: () => mocks.manageMutation,
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

function createItemsQuery(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined as MarketplaceListView | undefined,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    ...overrides,
  };
}

function createInstalledQuery(
  overrides: Partial<Record<string, unknown>> = {},
) {
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
    ...overrides,
  };
}

describe("MarketplacePage", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.docOpen.mockReset();
    mocks.confirm.mockReset();
    mocks.openExternalUrl.mockReset();
    mocks.routeParams = {};
    mocks.installMutation.mutateAsync.mockReset();
    mocks.manageMutation.mutate.mockReset();
    mocks.manageMutation.mutateAsync.mockReset();
    mocks.installMutation.isPending = false;
    mocks.installMutation.variables = undefined;
    mocks.manageMutation.isPending = false;
    mocks.manageMutation.variables = undefined;
    mocks.itemsQuery = createItemsQuery();
    mocks.installedQuery = createInstalledQuery();
  });

  it("renders skeleton cards during initial skills loading", () => {
    mocks.itemsQuery = createItemsQuery({
      isLoading: true,
      isFetching: true,
    });

    const { container } = render(<MarketplacePage forcedType="skills" />);

    expect(screen.getByText("Recently updated")).toBeTruthy();
    expect(screen.getByTestId("marketplace-recent-skeleton")).toBeTruthy();
    expect(screen.getByText("All Skills")).toBeTruthy();
    expect(screen.getByTestId("marketplace-list-skeleton")).toBeTruthy();
    expect(screen.queryByText("Skill Catalog")).toBeNull();
    expect(
      container.querySelectorAll(
        '[data-testid="marketplace-list-skeleton"] > article',
      ),
    ).toHaveLength(36);
  });

  it("keeps loaded cards visible during background refresh", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        sort: "relevance",
        items: [createMarketplaceItem()],
      } satisfies MarketplaceListView,
      isFetching: true,
    });

    render(<MarketplacePage forcedType="skills" />);

    expect(screen.queryByTestId("marketplace-list-skeleton")).toBeNull();
    expect(screen.getByTestId("marketplace-list-refreshing")).toBeTruthy();
    expect(screen.getAllByText("Updating...").length).toBeGreaterThan(0);
    expect(screen.getByText("Web Search")).toBeTruthy();
  });

  it("does not render a redundant type label in skill cards", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        sort: "relevance",
        items: [
          createMarketplaceItem(),
        ],
      } satisfies MarketplaceListView,
    });

    const { container } = render(<MarketplacePage forcedType="skills" />);
    const card = container.querySelector("article");

    expect(card?.textContent).toContain("@nextclaw/web-search");
    expect(card?.textContent).not.toContain("Skill");
  });

  it("hides redundant skill tags while keeping useful tags", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        sort: "relevance",
        items: [
          createMarketplaceItem({
            tags: ["skill", "automation", "Skill", "ops"],
          }),
        ],
      } satisfies MarketplaceListView,
    });

    render(<MarketplacePage forcedType="skills" />);

    expect(screen.queryByText("skill")).toBeNull();
    expect(screen.queryByText("Skill")).toBeNull();
    expect(screen.getAllByText("automation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ops").length).toBeGreaterThan(0);
  });

  it("does not dim the loaded list during background refresh", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        sort: "relevance",
        items: [createMarketplaceItem()],
      } satisfies MarketplaceListView,
      isFetching: true,
    });

    const { container } = render(<MarketplacePage forcedType="skills" />);

    expect(screen.getByText("Web Search")).toBeTruthy();
    expect(container.querySelector(".opacity-70")).toBeNull();
  });

  it("opens SkillHub from the marketplace tab row", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        sort: "relevance",
        items: [createMarketplaceItem()],
      } satisfies MarketplaceListView,
    });

    render(<MarketplacePage forcedType="skills" />);

    const openButton = screen.getByRole("button", {
      name: /SkillHub/i,
    });
    fireEvent.click(openButton);

    expect(mocks.openExternalUrl).toHaveBeenCalledWith("https://skillhub.cn/");
  });
});
