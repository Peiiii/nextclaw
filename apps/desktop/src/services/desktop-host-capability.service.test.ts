import assert from "node:assert/strict";
import test from "node:test";
import {
  DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
  DESKTOP_HOST_REVEAL_PATH_CHANNEL
} from "../utils/desktop-ipc.utils";
import { DesktopHostCapabilityService } from "./desktop-host-capability.service";

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

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
