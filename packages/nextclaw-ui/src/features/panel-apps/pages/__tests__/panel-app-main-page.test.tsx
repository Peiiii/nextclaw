import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PanelAppMainPage } from "@/features/panel-apps/pages/panel-app-main-page";
import { PANEL_APP_IFRAME_SANDBOX } from "@/features/panel-apps/utils/panel-app-iframe.utils";
import type { PanelAppEntryView } from "@/shared/lib/api";
import type * as SharedApi from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  bridgeMessage: vi.fn(),
  ensureClientGrant: vi.fn(async () => true),
  entries: [] as PanelAppEntryView[],
  openApps: vi.fn(),
  openTarget: vi.fn(),
  recordOpenedApi: vi.fn(),
  refetch: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({
    panelAppBridgeManager: { handleIframeMessage: mocks.bridgeMessage },
  }),
}));

vi.mock("@/features/panel-apps/hooks/use-panel-app-client-grant", () => ({
  usePanelAppClientGrant: () => ({
    ensurePanelAppClientGrant: mocks.ensureClientGrant,
    isPending: false,
  }),
}));

vi.mock("@/features/panel-apps/hooks/use-panel-apps", () => ({
  usePanelApps: () => ({
    data: { entries: mocks.entries },
    error: null,
    isError: false,
    isLoading: false,
    refetch: mocks.refetch,
  }),
  useUpdatePanelAppPreferences: () => ({
    isPending: false,
    mutate: mocks.updatePreferences,
  }),
}));

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    nextclawClient: {
      ...actual.nextclawClient,
      panelApps: {
        ...actual.nextclawClient.panelApps,
        recordPanelAppOpened: mocks.recordOpenedApi,
      },
    },
  };
});

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({ openTarget: mocks.openTarget }),
}));

vi.mock("@/features/panel-apps/utils/panel-app-doc-browser.utils", () => ({
  openApps: mocks.openApps,
}));

function createEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
  return {
    appId: "publisher.todo",
    clientDeclared: false,
    clientGranted: false,
    contentPath: "/api/panel-apps/publisher.todo/content",
    createdAt: "2026-08-19T00:00:00.000Z",
    favorite: false,
    fileName: "todo.panel.html",
    id: "todo",
    kind: "single-file",
    mainSidebar: true,
    mainSidebarOrder: 0,
    openCount: 0,
    sizeBytes: 10,
    title: "Rust Todo",
    updatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/apps/panel/publisher.todo"]}>
        <Routes>
          <Route path="/apps/panel/:appId" element={<PanelAppMainPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PanelAppMainPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.entries = [createEntry()];
    mocks.ensureClientGrant.mockResolvedValue(true);
    mocks.recordOpenedApi.mockResolvedValue(createEntry());
  });

  it("hosts the selected app in the existing sandbox and records one open", async () => {
    renderPage();

    const iframe = await screen.findByTitle("Rust Todo");
    expect(iframe.getAttribute("src")).toBe("/api/panel-apps/publisher.todo/content");
    expect(iframe.getAttribute("sandbox")).toBe(PANEL_APP_IFRAME_SANDBOX);
    await waitFor(() => expect(mocks.recordOpenedApi).toHaveBeenCalledWith("todo"));

    fireEvent(window, new MessageEvent("message", { data: { type: "ignored" } }));
    expect(mocks.bridgeMessage).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.any(MessageEvent),
      iframe,
    }));
  });

  it("renders the app edge-to-edge without a duplicate host header", async () => {
    renderPage();
    const iframe = await screen.findByTitle("Rust Todo");

    expect(screen.queryByRole("heading", { name: "Rust Todo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open in right panel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refresh current panel app" })).toBeNull();
    expect(iframe.parentElement?.children).toHaveLength(1);
    expect(iframe.className).toContain("h-full");
    expect(iframe.className).toContain("w-full");
  });

  it("does not mount a client-enabled app when authorization is denied", async () => {
    mocks.entries = [createEntry({ clientDeclared: true })];
    mocks.ensureClientGrant.mockResolvedValue(false);
    renderPage();

    expect(await screen.findByText(/required NextClaw Client permission was not granted/)).toBeTruthy();
    expect(screen.queryByTitle("Rust Todo")).toBeNull();
    expect(mocks.recordOpenedApi).not.toHaveBeenCalled();
  });

  it("does not reuse an old client grant decision across main-page instances", async () => {
    const queryClient = createQueryClient();
    mocks.entries = [createEntry({ clientDeclared: true })];
    const first = renderPage(queryClient);
    await screen.findByTitle("Rust Todo");
    expect(mocks.ensureClientGrant).toHaveBeenCalledTimes(1);

    first.unmount();
    await waitFor(() => expect(queryClient.getQueryData([
      "panel-app-main-client-grant",
      "publisher.todo",
      false,
    ])).toBeUndefined());

    renderPage(queryClient);
    await screen.findByTitle("Rust Todo");
    expect(mocks.ensureClientGrant).toHaveBeenCalledTimes(2);
  });

  it("shows a recoverable unavailable state for disabled or uninstalled apps", async () => {
    const user = userEvent.setup();
    mocks.entries = [];
    renderPage();

    expect(screen.getByText(/This panel app is unavailable/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open app management" }));
    expect(mocks.openApps).toHaveBeenCalledTimes(1);
  });
});
