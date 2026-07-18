import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { PANEL_APP_INLINE_HOST_CONTRACT } from "@nextclaw/shared";
import { getPanelAppBridgeScript } from "@kernel/utils/panel-app-bridge.utils.js";

describe("panel app inline host bridge", () => {
  it("reports dynamic content height after the inline card document is ready", () => {
    const postMessage = vi.fn();
    let notifyResize = () => undefined;
    const body = { clientHeight: 240, offsetHeight: 240, scrollHeight: 360 };
    const documentElement = {
      clientHeight: 240,
      offsetHeight: 240,
      scrollHeight: 360,
    };
    class InlineResizeObserver {
      constructor(callback: () => void) {
        notifyResize = callback;
      }

      observe = vi.fn();
    }
    const documentLike: {
      addEventListener: ReturnType<typeof vi.fn>;
      body: typeof body | null;
      documentElement: typeof documentElement;
      readyState: string;
    } = {
      addEventListener: vi.fn(),
      body: null,
      documentElement,
      readyState: "loading",
    };
    const windowLike = {
      addEventListener: vi.fn(),
      document: documentLike,
      location: {
        href: "http://localhost/panel",
        search: "?nextclawDisplayMode=card&nextclawPlacement=inline",
      },
      parent: { postMessage },
      ResizeObserver: InlineResizeObserver,
    };

    runInContext(
      getPanelAppBridgeScript(),
      createContext({ URLSearchParams, window: windowLike }),
    );
    expect(postMessage).not.toHaveBeenCalled();

    documentLike.body = body;
    const installReporter = documentLike.addEventListener.mock.calls[0]?.[1] as
      | (() => void)
      | undefined;
    installReporter?.();

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: PANEL_APP_INLINE_HOST_CONTRACT.contentHeightMessageType,
        height: 360,
      },
      "*",
    );

    body.scrollHeight = 560;
    body.clientHeight = 560;
    body.offsetHeight = 560;
    documentElement.offsetHeight = 560;
    notifyResize();

    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: PANEL_APP_INLINE_HOST_CONTRACT.contentHeightMessageType,
        height: 560,
      },
      "*",
    );

    body.clientHeight = 240;
    body.offsetHeight = 240;
    body.scrollHeight = 240;
    documentElement.offsetHeight = 240;
    notifyResize();

    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: PANEL_APP_INLINE_HOST_CONTRACT.contentHeightMessageType,
        height: 240,
      },
      "*",
    );
  });

  it("does not report content height outside inline card mode", () => {
    const postMessage = vi.fn();
    const windowLike = {
      addEventListener: vi.fn(),
      document: {
        body: { clientHeight: 240, offsetHeight: 240, scrollHeight: 360 },
        documentElement: {
          clientHeight: 240,
          offsetHeight: 240,
          scrollHeight: 360,
        },
        readyState: "complete",
      },
      location: { href: "http://localhost/panel", search: "" },
      parent: { postMessage },
    };

    runInContext(
      getPanelAppBridgeScript(),
      createContext({ URLSearchParams, window: windowLike }),
    );

    expect(postMessage).not.toHaveBeenCalled();
  });
});
