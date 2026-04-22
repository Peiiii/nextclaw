import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketplacePage } from "@/features/marketplace";
import type {
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceItemSummary,
  MarketplaceListView,
} from "@/shared/lib/api";

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
  confirm: vi.fn(),
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
    useParams: () => ({}),
  };
});

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen,
  }),
}));

vi.mock("@/app/components/providers/i18n-provider", () => ({
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

vi.mock("@/features/marketplace/hooks/use-marketplace", () => ({
  useMarketplaceItems: () => mocks.itemsQuery,
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

function createPluginMarketplaceItem(
  overrides: Partial<MarketplaceItemSummary> = {},
): MarketplaceItemSummary {
  return createMarketplaceItem({
    id: "plugin-codex-runtime",
    slug: "codex-runtime",
    type: "plugin",
    name: "Codex SDK NCP Runtime",
    summary: "Optional Codex runtime for NextClaw",
    summaryI18n: { en: "Optional Codex runtime for NextClaw" },
    install: {
      kind: "npm",
      spec: "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
      command: "npm install @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
    },
    ...overrides,
  });
}

function createInstalledRecord(
  overrides: Partial<MarketplaceInstalledRecord> = {},
): MarketplaceInstalledRecord {
  return {
    type: "plugin",
    id: "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
    spec: "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
    label: "Codex SDK NCP Runtime",
    enabled: true,
    origin: "marketplace",
    source: "marketplace",
    installedAt: "2026-03-19T00:00:00.000Z",
    ...overrides,
  };
}

function createItemsQuery(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined as MarketplaceListView | undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
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

    expect(screen.getByTestId("marketplace-list-skeleton")).toBeTruthy();
    expect(
      container.querySelectorAll(
        '[data-testid="marketplace-list-skeleton"] > article',
      ),
    ).toHaveLength(12);
  });

  it("keeps loaded cards visible during background refresh", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        sort: "relevance",
        items: [createMarketplaceItem()],
      } satisfies MarketplaceListView,
      isFetching: true,
    });

    render(<MarketplacePage forcedType="skills" />);

    expect(screen.queryByTestId("marketplace-list-skeleton")).toBeNull();
    expect(screen.getByText("Web Search")).toBeTruthy();
  });

  it("does not render the redundant plugin type label in plugin cards", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        sort: "relevance",
        items: [
          createMarketplaceItem({
            id: "plugin-codex-runtime",
            slug: "codex-runtime",
            type: "plugin",
            name: "Codex SDK NCP Runtime",
            summary: "Optional Codex runtime for NextClaw",
            summaryI18n: { en: "Optional Codex runtime for NextClaw" },
            install: {
              kind: "npm",
              spec: "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
              command:
                "npm install @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
            },
          }),
        ],
      } satisfies MarketplaceListView,
    });

    const { container } = render(<MarketplacePage forcedType="plugins" />);
    const card = container.querySelector("article");

    expect(card?.textContent).toContain(
      "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
    );
    expect(card?.textContent).not.toContain("Plugin");
  });

  it("does not dim the loaded list during background refresh", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        sort: "relevance",
        items: [createPluginMarketplaceItem()],
      } satisfies MarketplaceListView,
      isFetching: true,
    });

    const { container } = render(<MarketplacePage forcedType="plugins" />);

    expect(screen.getByText("Codex SDK NCP Runtime")).toBeTruthy();
    expect(container.querySelector(".opacity-70")).toBeNull();
  });

  it("only disables the targeted plugin action while a manage request is pending", async () => {
    const user = userEvent.setup();
    let resolveMutation: (() => void) | undefined;
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 2,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        sort: "relevance",
        items: [
          createPluginMarketplaceItem(),
          createPluginMarketplaceItem({
            id: "plugin-claude-runtime",
            slug: "claude-runtime",
            name: "Claude Agent Runtime",
            install: {
              kind: "npm",
              spec: "@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk",
              command:
                "npm install @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk",
            },
          }),
        ],
      } satisfies MarketplaceListView,
    });
    mocks.installedQuery = createInstalledQuery({
      data: {
        type: "plugin",
        total: 2,
        specs: [
          "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
          "@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk",
        ],
        records: [
          createInstalledRecord(),
          createInstalledRecord({
            id: "@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk",
            spec: "@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk",
            label: "Claude Agent Runtime",
          }),
        ],
      } satisfies MarketplaceInstalledView,
    });
    mocks.manageMutation.mutateAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );

    render(<MarketplacePage forcedType="plugins" />);

    const disableButtons = screen.getAllByRole("button", { name: "Disable" });
    const firstDisableButton = disableButtons[0];
    const secondDisableButton = disableButtons[1];

    await user.click(firstDisableButton);

    expect(mocks.manageMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(firstDisableButton.hasAttribute("disabled")).toBe(true);
    expect(firstDisableButton.textContent).toContain("Disabling");
    expect(secondDisableButton.hasAttribute("disabled")).toBe(false);

    resolveMutation?.();
  });
});
