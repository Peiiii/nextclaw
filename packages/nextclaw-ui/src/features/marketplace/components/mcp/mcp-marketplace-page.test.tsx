import { render, screen } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import { McpMarketplacePage } from "@/features/marketplace";
import type {
  MarketplaceInstalledView,
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
  itemsQuery: null as unknown as ItemsQueryState,
  installedQuery: null as unknown as InstalledQueryState,
  installMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  manageMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  doctorMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  confirm: vi.fn(),
  docOpen: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useMutation: () => mocks.doctorMutation,
  };
});

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({
    language: "zh",
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen,
  }),
}));

vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => null,
  }),
}));

vi.mock("@/features/marketplace/hooks/use-mcp-marketplace", () => ({
  useMcpMarketplaceItems: () => mocks.itemsQuery,
  useMcpMarketplaceInstalled: () => mocks.installedQuery,
  useInstallMcpMarketplaceItem: () => mocks.installMutation,
  useManageMcpMarketplaceItem: () => mocks.manageMutation,
}));

function createItemsQuery(
  overrides: Partial<ItemsQueryState> = {},
): ItemsQueryState {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function createInstalledQuery(
  overrides: Partial<InstalledQueryState> = {},
): InstalledQueryState {
  return {
    data: {
      type: "mcp",
      total: 0,
      specs: [],
      records: [],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

describe("McpMarketplacePage", () => {
  beforeEach(() => {
    mocks.installMutation.mutateAsync.mockReset();
    mocks.manageMutation.mutateAsync.mockReset();
    mocks.doctorMutation.mutateAsync.mockReset();
    mocks.confirm.mockReset();
    mocks.docOpen.mockReset();
    mocks.itemsQuery = createItemsQuery();
    mocks.installedQuery = createInstalledQuery();
  });

  it("prefers localized summary copy for the active language", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        sort: "relevance",
        items: [
          {
            id: "mcp-chrome-devtools",
            slug: "chrome-devtools",
            type: "mcp",
            name: "Chrome DevTools MCP",
            summary:
              "Connect MCP clients to Chrome DevTools for browser inspection and automation.",
            summaryI18n: {
              en: "Connect MCP clients to Chrome DevTools for browser inspection and automation.",
              zh: "把 MCP 客户端接入 Chrome DevTools，用于浏览器检查与自动化。",
            },
            tags: ["mcp", "browser"],
            author: "Chrome DevTools",
            install: {
              kind: "template",
              spec: "chrome-devtools",
              command:
                "nextclaw mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest",
            },
            updatedAt: "2026-03-19T00:00:00.000Z",
          },
        ],
      },
    });

    render(<McpMarketplacePage />);

    expect(
      screen.getByText(
        "把 MCP 客户端接入 Chrome DevTools，用于浏览器检查与自动化。",
      ),
    ).toBeTruthy();
  });

  it("hides install button when an installed record matches by spec without catalog slug", () => {
    mocks.itemsQuery = createItemsQuery({
      data: {
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        sort: "relevance",
        items: [
          {
            id: "mcp-chrome-devtools",
            slug: "chrome-devtools",
            type: "mcp",
            name: "Chrome DevTools MCP",
            summary:
              "Connect MCP clients to Chrome DevTools for browser inspection and automation.",
            summaryI18n: {
              en: "Connect MCP clients to Chrome DevTools for browser inspection and automation.",
              zh: "把 MCP 客户端接入 Chrome DevTools，用于浏览器检查与自动化。",
            },
            tags: ["mcp", "browser"],
            author: "Chrome DevTools",
            install: {
              kind: "template",
              spec: "chrome-devtools",
              command:
                "nextclaw mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest",
            },
            updatedAt: "2026-03-19T00:00:00.000Z",
          },
        ],
      },
    });
    mocks.installedQuery = createInstalledQuery({
      data: {
        type: "mcp",
        total: 1,
        specs: ["chrome-devtools"],
        records: [
          {
            type: "mcp",
            id: "chrome-devtools",
            spec: "chrome-devtools",
            label: "Chrome DevTools MCP",
            enabled: true,
            runtimeStatus: "enabled",
            transport: "stdio",
            scope: {
              allAgents: true,
              agents: [],
            },
          },
        ],
      },
    });

    render(<McpMarketplacePage />);

    expect(screen.queryByText("Install")).toBeNull();
    expect(screen.getByText("Disable")).toBeTruthy();
  });
});
