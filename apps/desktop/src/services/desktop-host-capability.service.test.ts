import assert from "node:assert/strict";
import test from "node:test";
import type { WebContents } from "electron";
import {
  DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
  DESKTOP_HOST_REVEAL_PATH_CHANNEL
} from "../utils/desktop-ipc.utils";
import { DesktopHostCapabilityService } from "./desktop-host-capability.service";

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;
type WindowOpenHandler = (details: { url: string }) => { action: "deny" };
type WillNavigateHandler = (event: {
  preventDefault: () => void;
  url: string;
}) => void;

function createFixture() {
  const handlers = new Map<string, Handler>();
  const openedUrls: string[] = [];
  const revealedPaths: string[] = [];
  const service = new DesktopHostCapabilityService({
    ipcMain: {
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel) => {
        handlers.delete(channel);
      }
    },
    shell: {
      openExternal: async (url) => {
        openedUrls.push(url);
      },
      showItemInFolder: (path) => {
        revealedPaths.push(path);
      }
    }
  });
  return { handlers, openedUrls, revealedPaths, service };
}

function createWebContentsFixture() {
  let windowOpenHandler: WindowOpenHandler | null = null;
  let willNavigateHandler: WillNavigateHandler | null = null;
  const webContents = {
    setWindowOpenHandler: (handler: WindowOpenHandler) => {
      windowOpenHandler = handler;
    },
    on: (event: string, handler: WillNavigateHandler) => {
      if (event === "will-navigate") {
        willNavigateHandler = handler;
      }
    }
  } as unknown as WebContents;
  return {
    getWindowOpenHandler: () => windowOpenHandler,
    getWillNavigateHandler: () => willNavigateHandler,
    webContents
  };
}

async function drainImmediate(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("opens http and https urls through the host shell", async () => {
  const { handlers, openedUrls, service } = createFixture();
  service.start();

  const handler = handlers.get(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL);
  assert.ok(handler);
  assert.deepEqual(await handler(null, "https://skillhub.cn"), { opened: true });
  assert.deepEqual(openedUrls, ["https://skillhub.cn/"]);
});

test("rejects unsupported url protocols", async () => {
  const { handlers, openedUrls, service } = createFixture();
  service.start();

  const handler = handlers.get(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL);
  assert.ok(handler);
  assert.deepEqual(await handler(null, "file:///tmp/demo"), {
    opened: false,
    reason: "unsupported-url"
  });
  assert.deepEqual(await handler(null, "javascript:alert(1)"), {
    opened: false,
    reason: "unsupported-url"
  });
  assert.deepEqual(openedUrls, []);
});

test("opens http and https window requests externally without creating Electron windows", async () => {
  const { openedUrls, service } = createFixture();
  const webContents = createWebContentsFixture();
  service.attachExternalNavigation(webContents.webContents, () => false);

  const handler = webContents.getWindowOpenHandler();
  assert.ok(handler);
  assert.deepEqual(handler({ url: "https://example.com/docs" }), { action: "deny" });
  assert.deepEqual(handler({ url: "http://example.com/help" }), { action: "deny" });
  await drainImmediate();

  assert.deepEqual(openedUrls, ["https://example.com/docs", "http://example.com/help"]);
});

test("rejects unsafe window requests without invoking the host shell", async () => {
  const { openedUrls, service } = createFixture();
  const webContents = createWebContentsFixture();
  service.attachExternalNavigation(webContents.webContents, () => false);

  const handler = webContents.getWindowOpenHandler();
  assert.ok(handler);
  assert.deepEqual(handler({ url: "javascript:alert(1)" }), { action: "deny" });
  await drainImmediate();

  assert.deepEqual(openedUrls, []);
});

test("allows trusted in-app navigation to remain in the desktop window", () => {
  const { openedUrls, service } = createFixture();
  const webContents = createWebContentsFixture();
  service.attachExternalNavigation(
    webContents.webContents,
    (url) => new URL(url).origin === "http://127.0.0.1:4100"
  );
  let prevented = false;

  const handler = webContents.getWillNavigateHandler();
  assert.ok(handler);
  handler({
    preventDefault: () => {
      prevented = true;
    },
    url: "http://127.0.0.1:4100/settings"
  });

  assert.equal(prevented, false);
  assert.deepEqual(openedUrls, []);
});

test("moves cross-origin navigation to the system browser", () => {
  const { openedUrls, service } = createFixture();
  const webContents = createWebContentsFixture();
  service.attachExternalNavigation(webContents.webContents, () => false);
  let prevented = false;

  const handler = webContents.getWillNavigateHandler();
  assert.ok(handler);
  handler({
    preventDefault: () => {
      prevented = true;
    },
    url: "https://example.com/docs"
  });

  assert.equal(prevented, true);
  assert.deepEqual(openedUrls, ["https://example.com/docs"]);
});

test("blocks unsafe cross-origin navigation without invoking the host shell", () => {
  const { openedUrls, service } = createFixture();
  const webContents = createWebContentsFixture();
  service.attachExternalNavigation(webContents.webContents, () => false);
  let prevented = false;

  const handler = webContents.getWillNavigateHandler();
  assert.ok(handler);
  handler({
    preventDefault: () => {
      prevented = true;
    },
    url: "file:///tmp/demo.html"
  });

  assert.equal(prevented, true);
  assert.deepEqual(openedUrls, []);
});

test("reveals absolute paths through the host shell", async () => {
  const { handlers, revealedPaths, service } = createFixture();
  service.start();

  const handler = handlers.get(DESKTOP_HOST_REVEAL_PATH_CHANNEL);
  assert.ok(handler);
  assert.deepEqual(await handler(null, "/tmp/demo.txt"), { revealed: true });
  assert.deepEqual(revealedPaths, ["/tmp/demo.txt"]);
});

test("rejects relative reveal paths", async () => {
  const { handlers, revealedPaths, service } = createFixture();
  service.start();

  const handler = handlers.get(DESKTOP_HOST_REVEAL_PATH_CHANNEL);
  assert.ok(handler);
  assert.deepEqual(await handler(null, "docs/demo.txt"), {
    revealed: false,
    reason: "unsupported-path"
  });
  assert.deepEqual(revealedPaths, []);
});

test("removes the host capability handler on dispose", () => {
  const { handlers, service } = createFixture();
  service.start();
  assert.equal(handlers.has(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL), true);
  assert.equal(handlers.has(DESKTOP_HOST_REVEAL_PATH_CHANNEL), true);

  service.dispose();

  assert.equal(handlers.has(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL), false);
  assert.equal(handlers.has(DESKTOP_HOST_REVEAL_PATH_CHANNEL), false);
});
