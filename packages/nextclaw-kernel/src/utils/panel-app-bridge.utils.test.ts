import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  PANEL_APP_INLINE_HOST_CONTRACT,
  PANEL_APP_SCROLL_RESTORATION_CONTRACT,
  createUiContentParamsWindowName,
} from "@nextclaw/shared";
import { getPanelAppBridgeScript } from "@kernel/utils/panel-app-bridge.utils.js";

describe("panel app scroll restoration bridge", () => {
  it("reports and restores the active Panel App scroll surface", () => {
    const postMessage = vi.fn();
    const scrollTo = vi.fn();
    const listeners = new Map<string, Array<(event?: MessageEvent) => void>>();
    const documentListeners = new Map<string, Array<(event?: MessageEvent) => void>>();
    const parent = { postMessage };
    const scrollSurface = {
      children: [],
      parentElement: null as unknown,
      scrollLeft: 18,
      scrollTop: 264,
      scrollTo,
      tagName: "DIV",
    };
    const body = { children: [scrollSurface] };
    scrollSurface.parentElement = body;
    const windowLike = {
      addEventListener: vi.fn((type: string, listener: (event?: MessageEvent) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      }),
      document: {
        addEventListener: vi.fn((type: string, listener: (event?: MessageEvent) => void) => {
          documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]);
        }),
        body,
        documentElement: {},
        readyState: "complete",
      },
      location: { href: "http://localhost/panel", origin: "http://localhost", search: "" },
      parent,
      requestAnimationFrame: (callback: () => void) => {
        callback();
        return 1;
      },
      scrollTo,
      scrollX: 0,
      scrollY: 0,
    };

    runInContext(
      getPanelAppBridgeScript(),
      createContext({ Number, URLSearchParams, window: windowLike }),
    );

    expect(postMessage).not.toHaveBeenCalled();

    documentListeners.get("scroll")?.forEach((listener) => listener({ target: scrollSurface } as MessageEvent));

    expect(postMessage).toHaveBeenCalledWith({
      type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.scrollMessageType,
      version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
      target: {
        kind: "element",
        path: [{ index: 0, tagName: "div" }],
      },
      x: 18,
      y: 264,
    }, "*");

    listeners.get("message")?.forEach((listener) => listener({
      data: {
        type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.restoreScrollMessageType,
        version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
        target: {
          kind: "element",
          path: [{ index: 0, tagName: "div" }],
        },
        x: 36,
        y: 528,
      },
      source: parent,
    } as MessageEvent));

    expect(scrollTo).toHaveBeenCalledWith(36, 528);
  });

  it("restores document scroll after asynchronous Panel App content renders", () => {
    const postMessage = vi.fn();
    const listeners = new Map<string, Array<(event?: MessageEvent) => void>>();
    const documentListeners = new Map<string, Array<(event?: MessageEvent) => void>>();
    const parent = { postMessage };
    const body = { children: [] };
    const documentElement = { clientHeight: 637, scrollHeight: 637 };
    let viewportX = 12;
    let viewportY = 432;
    let notifyResize = () => undefined;
    const scrollTo = vi.fn((x: number, y: number) => {
      viewportX = x;
      viewportY = Math.min(y, documentElement.scrollHeight - documentElement.clientHeight);
    });
    class PanelResizeObserver {
      constructor(callback: () => void) {
        notifyResize = callback;
      }

      disconnect = vi.fn();
      observe = vi.fn();
    }
    const documentLike = {
      addEventListener: vi.fn((type: string, listener: (event?: MessageEvent) => void) => {
        documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]);
      }),
      body,
      documentElement,
      readyState: "complete",
      scrollingElement: body,
    };
    const windowLike = {
      addEventListener: vi.fn((type: string, listener: (event?: MessageEvent) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      }),
      document: documentLike,
      location: { href: "http://localhost/panel", origin: "http://localhost", search: "" },
      parent,
      ResizeObserver: PanelResizeObserver,
      requestAnimationFrame: (callback: () => void) => {
        callback();
        return 1;
      },
      scrollTo,
      get scrollX() {
        return viewportX;
      },
      get scrollY() {
        return viewportY;
      },
    };

    runInContext(
      getPanelAppBridgeScript(),
      createContext({ Number, URLSearchParams, window: windowLike }),
    );

    documentListeners.get("scroll")?.forEach((listener) => listener({ target: documentLike } as MessageEvent));

    expect(postMessage).toHaveBeenCalledWith({
      type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.scrollMessageType,
      version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
      target: { kind: "document" },
      x: 12,
      y: 432,
    }, "*");

    viewportX = 0;
    viewportY = 0;

    listeners.get("message")?.forEach((listener) => listener({
      data: {
        type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.restoreScrollMessageType,
        version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
        target: { kind: "document" },
        x: 24,
        y: 864,
      },
      source: parent,
    } as MessageEvent));

    expect(scrollTo).toHaveBeenCalledWith(24, 864);
    expect(viewportY).toBe(0);

    documentElement.scrollHeight = 1501;
    notifyResize();

    expect(viewportY).toBe(864);
  });
});

describe("panel app inline host bridge", () => {
  it("preserves bootstrapped params when installing Panel App capabilities", () => {
    const windowLike = {
      addEventListener: vi.fn(),
      document: {
        body: null,
        documentElement: {},
        readyState: "complete",
      },
      location: { href: "http://localhost/panel", origin: "http://localhost", search: "" },
      name: createUiContentParamsWindowName({
        file: { path: "/tmp/photo.png" },
      }),
      parent: { postMessage: vi.fn() },
    };

    runInContext(
      getPanelAppBridgeScript(),
      createContext({ URLSearchParams, window: windowLike }),
    );

    expect(windowLike.name).toBe("");
    expect(windowLike.nextclaw).toMatchObject({
      params: {
        file: { path: "/tmp/photo.png" },
      },
      agent: {
        send: expect.any(Function),
      },
      serviceActions: {
        invoke: expect.any(Function),
      },
      verificationRecords: {
        list: expect.any(Function),
      },
      portableRuntimeAcceptance: {
        status: expect.any(Function),
        export: expect.any(Function),
      },
    });
  });

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
