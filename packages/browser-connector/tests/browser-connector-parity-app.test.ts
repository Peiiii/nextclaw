import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBrowserConnectorApp } from "../src/app/browser-connector-app.js";
import { resolveBrowserConnectorIpcPath } from "../src/utils/ipc-path.utils.js";
import type {
  BrowserIpcRequest,
  BrowserIpcResponse,
} from "../src/types/browser-connector-json.types.js";

describe("BrowserConnectorApp Codex parity commands", function () {
  let homeDir: string;
  let nativeHostDir: string;
  let nativeHostPath: string;
  let fakeServer: Server | undefined;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "browser-connector-home-"));
    nativeHostDir = await mkdtemp(join(tmpdir(), "browser-connector-hosts-"));
    nativeHostPath = join(homeDir, "native-host-launcher.js");
    await writeFile(nativeHostPath, "#!/usr/bin/env node\n");
    process.env.BROWSER_CONNECTOR_CHROME_NATIVE_HOST_DIR = nativeHostDir;
    process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH = nativeHostPath;
  });

  afterEach(async () => {
    await stopFakeServer(fakeServer);
    fakeServer = undefined;
    delete process.env.BROWSER_CONNECTOR_CHROME_NATIVE_HOST_DIR;
    delete process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH;
    await rm(homeDir, { recursive: true, force: true });
    await rm(nativeHostDir, { recursive: true, force: true });
  });

  it("routes inspect, fill, form actions, waits, and logs through IPC", async () => {
    fakeServer = await startFakeServer(resolveBrowserConnectorIpcPath(homeDir));
    const app = createBrowserConnectorApp(homeDir);

    const inspected = await app.run(["page", "inspect", "--lease", "lease-1", "--ref", "i2", "--json"]);
    const filled = await app.run([
      "page", "fill", "--lease", "lease-1", "--selector", "textarea[data-testid=\"lyrics-textarea\"]",
      "--mode", "paste", "--text", "hello connector", "--reason", "fill lyrics", "--json",
    ]);
    const checked = await app.run(["page", "check", "--lease", "lease-1", "--selector", "#enabled", "--reason", "enable custom mode", "--json"]);
    const selected = await app.run([
      "page", "select", "--lease", "lease-1", "--selector", "#genre",
      "--value", "folk", "--reason", "choose genre", "--json",
    ]);
    const waitUrl = await app.run(["page", "wait-url", "--lease", "lease-1", "--url", "example.com", "--reason", "wait url", "--json"]);
    const waitLoad = await app.run(["page", "wait-load", "--lease", "lease-1", "--reason", "wait load", "--json"]);
    const logs = await app.run(["page", "logs", "--lease", "lease-1", "--level", "error", "--json"]);

    expect(inspected).toMatchObject({ ok: true, inspect: { element: { count: 1, enabled: true } } });
    expect(filled).toMatchObject({ ok: true, action: { action: "page.fill", inputMode: "paste", matchedExpectedText: true, pageTextMatched: true } });
    expect(checked).toMatchObject({ ok: true, action: { action: "page.check", element: { checked: true } } });
    expect(selected).toMatchObject({ ok: true, action: { action: "page.select", element: { value: "folk" } } });
    expect(waitUrl).toMatchObject({ ok: true, action: { action: "page.wait-url", urlMatched: "example.com" } });
    expect(waitLoad).toMatchObject({ ok: true, action: { action: "page.wait-load", loadState: "complete" } });
    expect(logs).toMatchObject({ ok: true, action: { action: "page.logs", logs: [{ level: "error" }] } });
  });

  it("requires confirmation before closing a tab not opened by the connector", async () => {
    fakeServer = await startFakeServer(resolveBrowserConnectorIpcPath(homeDir));
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run(["tabs", "close", "chrome-tab:1", "--reason", "close user tab", "--json"]);

    expect(output).toMatchObject({
      ok: false,
      error: { code: "ACTION_REQUIRES_CONFIRMATION" },
    });
  });

  it("rejects unsupported text entry modes before IPC", async () => {
    fakeServer = await startFakeServer(resolveBrowserConnectorIpcPath(homeDir));
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run([
      "page", "fill", "--lease", "lease-1", "--selector", "textarea",
      "--mode", "clipboard", "--text", "hello connector", "--reason", "fill text", "--json",
    ]);

    expect(output).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_ARGUMENT",
        message: "page fill/type --mode must be direct or paste.",
      },
    });
  });
});

const startFakeServer = async (ipcPath: string): Promise<Server> => {
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) return;
      const request = JSON.parse(buffer.slice(0, newlineIndex)) as BrowserIpcRequest;
      socket.end(`${JSON.stringify(fakeResponse(request))}\n`);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(ipcPath, resolve);
  });

  return server;
};

const stopFakeServer = async (server: Server | undefined): Promise<void> => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

const fakeResponse = (request: BrowserIpcRequest): BrowserIpcResponse => {
  if (request.command === "tabs.close") return fakeCloseResponse(request);
  if (request.command === "page.inspect") return fakeInspectResponse(request);
  if (request.command === "page.fill") return fakeFillResponse(request);
  if (request.command === "page.check") return fakeCheckResponse(request);
  if (request.command === "page.select") return fakeSelectResponse(request);
  if (request.command === "page.wait-url") return fakeActionResponse(request, { action: "page.wait-url", urlMatched: request.payload?.url });
  if (request.command === "page.wait-load") return fakeActionResponse(request, { action: "page.wait-load", loadState: "complete" });
  if (request.command === "page.logs") {
    return fakeActionResponse(request, {
      action: "page.logs",
      logs: [{ level: "error", message: "demo error", timestamp: "2026-06-07T00:00:00.000Z" }],
    });
  }
  return {
    id: request.id,
    ok: false,
    error: { code: "INVALID_ARGUMENT", message: `Unexpected command: ${request.command}`, recoverable: false },
  };
};

const fakeInspectResponse = (request: BrowserIpcRequest): BrowserIpcResponse => ({
  id: request.id,
  ok: true,
  data: {
    tab: fakeTab(),
    target: { ref: request.payload?.ref, selector: "div:nth-of-type(4) > div:nth-of-type(2)" },
    element: {
      count: 1,
      unique: true,
      ref: request.payload?.ref,
      selector: "div:nth-of-type(4) > div:nth-of-type(2)",
      text: "Create",
      role: "button",
      kind: "button",
      tagName: "div",
      visible: true,
      disabled: false,
      enabled: true,
    },
    warning: "untrusted-browser-page-content",
  },
});

const fakeFillResponse = (request: BrowserIpcRequest): BrowserIpcResponse =>
  fakeActionResponse(request, {
    action: "page.fill",
    selector: request.payload?.selector,
    inputMode: request.payload?.mode,
    valueLength: 15,
    preview: "hello connector",
    matchedExpectedText: true,
    pageTextMatched: true,
    changed: true,
    element: { selector: request.payload?.selector, tagName: "textarea", valueLength: 15, editable: true },
  });

const fakeCheckResponse = (request: BrowserIpcRequest): BrowserIpcResponse =>
  fakeActionResponse(request, {
    action: "page.check",
    selector: request.payload?.selector,
    changed: true,
    element: { selector: request.payload?.selector, checked: true, enabled: true },
  });

const fakeSelectResponse = (request: BrowserIpcRequest): BrowserIpcResponse =>
  fakeActionResponse(request, {
    action: "page.select",
    selector: request.payload?.selector,
    changed: true,
    element: { selector: request.payload?.selector, value: request.payload?.value, enabled: true },
  });

const fakeActionResponse = (
  request: BrowserIpcRequest,
  action: Record<string, unknown>,
): BrowserIpcResponse => ({
  id: request.id,
  ok: true,
  data: { tab: fakeTab(), ...action },
});

const fakeCloseResponse = (request: BrowserIpcRequest): BrowserIpcResponse => ({
  id: request.id,
  ok: false,
  error: {
    code: "ACTION_REQUIRES_CONFIRMATION",
    message: "tabs.close requires confirmed user approval for tabs not opened by Browser Connector.",
    recoverable: true,
  },
});

const fakeTab = () => ({
  tabRef: "chrome-tab:1",
  title: "Example",
  url: "https://example.com/",
  active: true,
});
