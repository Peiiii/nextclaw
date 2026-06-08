import assert from "node:assert/strict";
import test from "node:test";
import { DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL } from "../utils/desktop-ipc.utils";
import { DesktopHostCapabilityService } from "./desktop-host-capability.service";

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

function createFixture() {
  const handlers = new Map<string, Handler>();
  const openedUrls: string[] = [];
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
      }
    }
  });
  return { handlers, openedUrls, service };
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

test("removes the host capability handler on dispose", () => {
  const { handlers, service } = createFixture();
  service.start();
  assert.equal(handlers.has(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL), true);

  service.dispose();

  assert.equal(handlers.has(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL), false);
});
