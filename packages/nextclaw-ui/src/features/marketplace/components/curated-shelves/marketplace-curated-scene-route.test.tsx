import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  isFetchingNextPage?: boolean;
  isError: boolean;
  error: Error | null;
};

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  docOpen: vi.fn(),
  routeParams: {} as { scene?: string },
  itemsQuery: null as unknown as ItemsQueryState,
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
  }),
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
  useMarketplaceSkillScenes: () => ({
    data: {
      scenes: [
        {
          scene: "development-debugging",
          title: "Development",
          description: "Review, debug, analyze, and verify delivery work.",
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useMarketplaceSkillSceneCounts: () => new Map([["development-debugging", 2]]),
  useMarketplaceInstalled: () => ({
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
  }),
  useInstallMarketplaceItem: () => ({
    mutateAsync: vi.fn(),
  }),
  useManageMarketplaceItem: () => ({
    mutateAsync: vi.fn(),
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

function createSceneItems(): MarketplaceItemSummary[] {
  return [
    createMarketplaceItem({
      id: "skill-code-review",
      slug: "code-review",
      name: "Code Review",
      summary: "Review code changes",
      tags: ["code", "review"],
    }),
    createMarketplaceItem({
      id: "skill-debug-lab",
      slug: "debug-lab",
      name: "Debug Lab",
      summary: "Debug runtime failures",
      tags: ["debug"],
    }),
    createMarketplaceItem({
      id: "skill-calendar-sync",
      slug: "calendar-sync",
      name: "Calendar Sync",
      summary: "Sync calendar events",
      tags: ["calendar"],
    }),
    createMarketplaceItem({
      id: "skill-writing-room",
      slug: "writing-room",
      name: "Writing Room",
      summary: "Draft long-form writing",
      tags: ["writing"],
    }),
  ];
}

function createItemsQuery(items: MarketplaceItemSummary[]) {
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

describe("Marketplace curated scene routes", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.docOpen.mockReset();
    mocks.routeParams = {};
    mocks.itemsQuery = createItemsQuery(createSceneItems());
  });

  it("opens curated goals through a scene route", async () => {
    const user = userEvent.setup();
    const { container } = render(<MarketplacePage forcedType="skills" />);

    await user.click(screen.getByRole("button", { name: /Development/ }));

    expect(screen.getByText("2 skills")).toBeTruthy();
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/skills/scenes/development-debugging",
    );
    expect(container.querySelector("input")?.getAttribute("value") ?? "").toBe("");
  });

  it("renders scene routes as adaptive grids without the catalog shell", async () => {
    const user = userEvent.setup();
    mocks.routeParams = { scene: "development-debugging" };
    mocks.itemsQuery = createItemsQuery(createSceneItems().slice(0, 2));

    render(<MarketplacePage forcedType="skills" />);

    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByText("Code Review")).toBeTruthy();
    expect(screen.queryByText("Calendar Sync")).toBeNull();
    expect(screen.queryByText("Skill Catalog")).toBeNull();
    expect(screen.queryByPlaceholderText("Search skills...")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/skills");
  });

  it("shows a scene loading state instead of stale catalog items", () => {
    mocks.routeParams = { scene: "development-debugging" };
    mocks.itemsQuery = {
      ...createItemsQuery([]),
      data: undefined,
      isLoading: true,
      isFetching: true,
    };

    render(<MarketplacePage forcedType="skills" />);

    expect(screen.getByTestId("marketplace-scene-skeleton")).toBeTruthy();
    expect(screen.queryByText("Calendar Sync")).toBeNull();
    expect(screen.queryByPlaceholderText("Search skills...")).toBeNull();
  });
});
