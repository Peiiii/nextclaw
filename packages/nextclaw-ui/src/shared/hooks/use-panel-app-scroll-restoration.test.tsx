import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_APP_SCROLL_RESTORATION_CONTRACT } from "@nextclaw/shared";
import { usePanelAppScrollRestoration } from "@/shared/hooks/use-panel-app-scroll-restoration";
import { scrollRestorationManager } from "@/shared/lib/navigation-history";

function PanelAppFrame({ currentUrl = "/app", restorationKey = "panel-app:test" }: {
  currentUrl?: string;
  restorationKey?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const restoreScroll = usePanelAppScrollRestoration({
    currentUrl,
    iframeRef,
    isEnabled: true,
    restorationKey,
  });
  return <iframe ref={iframeRef} data-testid="panel-app-frame" onLoad={restoreScroll} />;
}

describe("usePanelAppScrollRestoration", () => {
  beforeEach(() => scrollRestorationManager.clear());

  it("records only scroll messages from its iframe and restores them after load", () => {
    const { getByTestId } = render(<PanelAppFrame />);
    const iframe = getByTestId("panel-app-frame") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    const target = { kind: "document" } as const;

    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.scrollMessageType,
        version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
        target,
        x: 8,
        y: 64,
      },
      source: iframe.contentWindow,
    }));
    fireEvent.load(iframe);

    expect(postMessage).toHaveBeenCalledWith({
      type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.restoreScrollMessageType,
      version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
      target,
      x: 8,
      y: 64,
    }, "*");
  });

  it("does not restore a position from another resource URL", () => {
    scrollRestorationManager.save("panel-app:test", {
      x: 0,
      y: 64,
      payload: { currentUrl: "/old-app", target: { kind: "document" } },
    });
    const { getByTestId } = render(<PanelAppFrame currentUrl="/new-app" />);
    const iframe = getByTestId("panel-app-frame") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    fireEvent.load(iframe);

    expect(postMessage).not.toHaveBeenCalled();
  });
});

it("keeps independent URL positions when navigating A to B and back to A", () => {
  scrollRestorationManager.clear();
  const view = render(<PanelAppFrame currentUrl="/a" />);
  const frame = view.getByTestId('panel-app-frame') as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, 'postMessage');
  const record = (y: number) => window.dispatchEvent(new MessageEvent('message', {
    source: frame.contentWindow, data: { type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.scrollMessageType, version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version, target: { kind: 'document' }, x: 0, y },
  }));
  record(400);
  view.rerender(<PanelAppFrame currentUrl="/b" />);
  record(80);
  view.rerender(<PanelAppFrame currentUrl="/a" />);
  fireEvent.load(frame);
  expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ y: 400 }), '*');
  view.rerender(<PanelAppFrame currentUrl="/b" />);
  fireEvent.load(frame);
  expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ y: 80 }), '*');
});
