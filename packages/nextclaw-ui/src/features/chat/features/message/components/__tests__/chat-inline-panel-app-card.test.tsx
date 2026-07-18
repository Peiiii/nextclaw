import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PANEL_APP_INLINE_HOST_CONTRACT } from "@nextclaw/shared";
import { ChatInlinePanelAppCard } from "@/features/chat/features/message/components/chat-inline-panel-app-card";

const mocks = vi.hoisted(() => ({
  handleIframeMessage: vi.fn(),
  open: vi.fn(),
  openTarget: vi.fn(),
  panelApps: {
    data: {
      entries: [
        {
          appId: "weather-card",
          contentPath: "/api/panel-apps/weather-card/content",
          fileName: "weather-card.panel.html",
          icon: "*",
          id: "weather-card",
          title: "Weather",
        },
      ],
    },
    isLoading: false,
  },
}));

vi.mock("@/app/presenters/app.presenter", () => ({
  getPresenter: () => ({
    panelAppBridgeManager: {
      handleIframeMessage: mocks.handleIframeMessage,
    },
  }),
}));

vi.mock("@/features/panel-apps", () => ({
  PANEL_APP_IFRAME_SANDBOX:
    "allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock allow-presentation",
  findPanelAppEntryByDisplayId: (
    entries: Array<{ appId: string; id: string; title: string }>,
    value: string,
  ) =>
    entries.find((entry) =>
      [entry.appId, entry.id, entry.title].includes(value),
    ) ?? null,
  focusPanelAppIframe: (iframe: HTMLIFrameElement | null) => {
    iframe?.focus({ preventScroll: true });
    iframe?.contentWindow?.focus();
  },
  usePanelApps: () => mocks.panelApps,
}));

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    open: mocks.open,
    openTarget: mocks.openTarget,
  }),
}));

vi.mock("@/shared/lib/i18n", () => ({
  t: (key: string) => key,
}));

beforeEach(() => {
  mocks.handleIframeMessage.mockReset();
  mocks.open.mockReset();
  mocks.openTarget.mockReset();
  mocks.panelApps.isLoading = false;
});

it("renders panel apps through the shared adaptive inline surface", () => {
  const { container } = render(
    <ChatInlinePanelAppCard
      panelApp={{
        appId: "weather-card",
        title: "Weather",
      }}
    />,
  );

  const iframe = screen.getByTitle("Weather") as HTMLIFrameElement;
  const surface = iframe.closest('[data-chat-inline-content-surface="true"]');
  const actions = container.querySelector(
    '[data-chat-inline-content-actions="true"]',
  );
  const viewport = container.querySelector<HTMLElement>(
    '[data-chat-inline-content-viewport="true"]',
  );
  expect(surface?.className).toContain("w-full");
  expect(surface?.className).toContain("max-w-[48rem]");
  expect(surface?.classList.contains("border")).toBe(false);
  expect(screen.queryByText("Weather")).toBeNull();
  expect(viewport?.classList.contains("h-[240px]")).toBe(true);
  expect(viewport?.classList.contains("max-h-[min(90vh,1440px)]")).toBe(true);
  expect(actions?.classList.contains("opacity-0")).toBe(true);
  expect(actions?.classList.contains("pointer-events-none")).toBe(true);
  expect(
    actions?.classList.contains("group-hover/inline-content:opacity-100"),
  ).toBe(true);
  expect(iframe.getAttribute("src")).toBe(
    "/api/panel-apps/weather-card/content?nextclawDisplayMode=card&nextclawPlacement=inline",
  );

  fireEvent(
    window,
    new MessageEvent("message", {
      data: {
        type: PANEL_APP_INLINE_HOST_CONTRACT.contentHeightMessageType,
        height: 560,
      },
      source: iframe.contentWindow,
    }),
  );

  expect(viewport?.style.height).toBe("560px");
  expect(screen.getByTitle("Weather")).toBe(iframe);

  fireEvent.click(screen.getByLabelText("chatPanelCardExpand"));

  expect(mocks.openTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      dedupeKey: "panel-app:weather-card",
      kind: "panel-app",
      title: "Weather",
      url: "/api/panel-apps/weather-card/content",
    }),
  );
});

it("ignores inline height messages from a different window", () => {
  const { container } = render(
    <ChatInlinePanelAppCard
      panelApp={{
        appId: "weather-card",
        title: "Weather",
      }}
    />,
  );
  const viewport = container.querySelector<HTMLElement>(
    '[data-chat-inline-content-viewport="true"]',
  );

  fireEvent(
    window,
    new MessageEvent("message", {
      data: {
        type: PANEL_APP_INLINE_HOST_CONTRACT.contentHeightMessageType,
        height: 560,
      },
      source: window,
    }),
  );

  expect(viewport?.style.height).toBe("");
});

it("focuses the inline panel app iframe when the pointer enters it", () => {
  render(
    <ChatInlinePanelAppCard
      panelApp={{
        appId: "weather-card",
        title: "Weather",
      }}
    />,
  );

  const iframe = screen.getByTitle("Weather") as HTMLIFrameElement;
  const iframeFocus = vi.spyOn(iframe, "focus");
  const contentWindowFocus = vi
    .spyOn(iframe.contentWindow!, "focus")
    .mockImplementation(() => undefined);

  fireEvent.pointerOver(iframe);

  expect(iframe.getAttribute("tabindex")).toBe("0");
  expect(iframeFocus).toHaveBeenCalledWith({ preventScroll: true });
  expect(contentWindowFocus).toHaveBeenCalled();
});

it("can render inline panel apps without a side-panel expand action", () => {
  render(
    <ChatInlinePanelAppCard
      panelApp={{
        appId: "weather-card",
        title: "Weather",
      }}
      showExpandAction={false}
    />,
  );

  expect(screen.getByTitle("Weather")).toBeTruthy();
  expect(screen.queryByLabelText("chatPanelCardExpand")).toBeNull();
  expect(
    document.querySelector('[data-chat-inline-content-actions="true"]'),
  ).toBeNull();
  expect(mocks.open).not.toHaveBeenCalled();
  expect(mocks.openTarget).not.toHaveBeenCalled();
});
