import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBrowserConnectorApp } from "../src/app/browser-connector-app.js";
import { BrowserConnectorClient } from "../src/services/browser-connector-client.service.js";
import { ConfigRepository } from "../src/repositories/config.repository.js";
import { NativeHostService } from "../src/services/native-host.service.js";
import { resolveBrowserConnectorIpcPath } from "../src/utils/ipc-path.utils.js";
import { NativeMessagingConnection } from "../src/utils/native-messaging-protocol.utils.js";
import { redactBrowserUrl } from "../src/utils/url-redaction.utils.js";
import type {
  BrowserIpcRequest,
  BrowserIpcResponse,
} from "../src/types/browser-connector-json.types.js";
import { SUPPORTED_BROWSER_IPC_COMMANDS } from "../src/types/browser-connector-json.types.js";

type NativeTestMessage = Record<string, unknown> & {
  requestId?: string;
};

describe("redactBrowserUrl", () => {
  it("redacts query, hash, and known session path segments from browser URLs", () => {
    expect(
      redactBrowserUrl("http://127.0.0.1:5174/chat/sid_secret123?token=1#key"),
    ).toBe("http://127.0.0.1:5174/chat/sid_redacted");
  });
});

describe("BrowserConnectorApp", function () {
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
    delete process.env.BROWSER_CONNECTOR_NATIVE_HOST_LAUNCHER_PATH;
    delete process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH;
    await rm(homeDir, { recursive: true, force: true });
    await rm(nativeHostDir, { recursive: true, force: true });
  });

  it("reports the package version", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run(["--version"]);

    expect(output).toEqual({
      ok: true,
      output: "0.1.0",
    });
  });

  it("installs a Chrome Native Host manifest into the configured host directory", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run(["install", "chrome", "--json"]);

    expect(output.ok).toBe(true);
    const manifestPath = join(nativeHostDir, "com.nextclaw.browserconnector.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      path: string;
      allowed_origins: string[];
    };
    expect(manifest.path).toBe(nativeHostPath);
    expect(manifest.allowed_origins).toEqual([
      "chrome-extension://pbpjjfnofpmgofhghjnfceiljmbdgieb/",
    ]);
  });

  it("writes a Native Host wrapper with the absolute Node runtime", async () => {
    delete process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH;
    process.env.BROWSER_CONNECTOR_NATIVE_HOST_LAUNCHER_PATH = nativeHostPath;
    const app = createBrowserConnectorApp(homeDir);
    await app.run(["install", "chrome", "--json"]);

    const manifestPath = join(nativeHostDir, "com.nextclaw.browserconnector.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      path: string;
    };
    const wrapper = await readFile(manifest.path, "utf8");

    expect(manifest.path).toBe(
      join(
        homeDir,
        "native-host",
        `com.nextclaw.browserconnector${process.platform === "win32" ? ".cmd" : ""}`,
      ),
    );
    expect(wrapper).toContain(process.execPath);
    expect(wrapper).toContain(nativeHostPath);
  });

  it("sets up Chrome integration and returns one-step user guidance", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run(["setup", "chrome", "--json"]);

    expect(output).toMatchObject({
      ok: true,
      ready: false,
      checks: [
        { name: "native-host-manifest", ok: true },
        { name: "extension-assets", ok: true },
        { name: "native-host-ipc", ok: false },
      ],
    });
    expect(output.ok ? output.nextSteps : []).toEqual(
      expect.arrayContaining([expect.stringContaining("chrome://extensions")]),
    );
  });
});

describe("BrowserConnectorApp browser workflow commands", function () {
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
    delete process.env.BROWSER_CONNECTOR_NATIVE_HOST_LAUNCHER_PATH;
    delete process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH;
    await rm(homeDir, { recursive: true, force: true });
    await rm(nativeHostDir, { recursive: true, force: true });
  });

  it("uses the IPC command tree for tabs, page reads, navigation, and finalize", async () => {
    fakeServer = await startFakeServer(resolveBrowserConnectorIpcPath(homeDir));
    const app = createBrowserConnectorApp(homeDir);
    const listed = await app.run(["tabs", "list", "--json"]);
    const selected = await app.run(["tabs", "selected", "--json"]);
    const fetched = await app.run(["tabs", "get", "chrome-tab:1", "--json"]);
    const opened = await app.run([
      "tabs",
      "open",
      "https://example.com/?secret=1#token",
      "--reason",
      "open evaluation page",
      "--json",
    ]);
    const foregroundOpened = await app.run([
      "tabs",
      "open",
      "https://example.com/",
      "--reason",
      "show page to user",
      "--foreground",
      "--json",
    ]);
    const claimed = await app.run([
      "tabs",
      "claim",
      "chrome-tab:1",
      "--reason",
      "read user selected tab",
      "--json",
    ]);
    const snapshot = await app.run([
      "page",
      "snapshot",
      "--lease",
      "lease-1",
      "--json",
    ]);
    const screenshotPath = join(homeDir, "screenshot.png");
    const screenshot = await app.run([
      "page",
      "screenshot",
      "--lease",
      "lease-1",
      "--output",
      screenshotPath,
      "--json",
    ]);
    const reload = await app.run([
      "page",
      "reload",
      "--lease",
      "lease-1",
      "--reason",
      "reload evaluation page",
      "--json",
    ]);
    const finalized = await app.run([
      "tabs",
      "finalize",
      "--lease",
      "lease-1",
      "--json",
    ]);

    expect(listed).toMatchObject({
      ok: true,
      tabs: [{ tabRef: "chrome-tab:1", title: "Example" }],
    });
    expect(selected).toMatchObject({
      ok: true,
      tab: { tabRef: "chrome-tab:1" },
    });
    expect(fetched).toMatchObject({
      ok: true,
      tab: { tabRef: "chrome-tab:1" },
    });
    expect(opened).toMatchObject({
      ok: true,
      tab: { tabRef: "chrome-tab:3", url: "https://example.com/", active: false },
    });
    expect(foregroundOpened).toMatchObject({
      ok: true,
      tab: { tabRef: "chrome-tab:3", url: "https://example.com/", active: true },
    });
    expect(claimed).toMatchObject({
      ok: true,
      lease: { leaseId: "lease-1" },
    });
    expect(snapshot).toMatchObject({
      ok: true,
      snapshot: {
        warning: "untrusted-browser-page-content",
        text: "Hello from the browser",
      },
    });
    expect(screenshot).toMatchObject({
      ok: true,
      screenshot: {
        mimeType: "image/png",
        outputPath: screenshotPath,
      },
    });
    await expect(access(screenshotPath)).resolves.toBeUndefined();
    expect(reload).toMatchObject({
      ok: true,
      action: {
        action: "page.reload",
        tab: { tabRef: "chrome-tab:1" },
      },
    });
    expect(finalized).toEqual({
      ok: true,
      finalized: true,
      leaseId: "lease-1",
    });
  });

  it("requires explicit confirmation for key press actions", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run([
      "page",
      "press",
      "--lease",
      "lease-1",
      "--keys",
      "Enter",
      "--reason",
      "submit search form",
      "--json",
    ]);

    expect(output).toMatchObject({
      ok: false,
      error: {
        code: "ACTION_REQUIRES_CONFIRMATION",
      },
    });
  });

  it("rejects non-web URLs when opening tabs", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run([
      "tabs",
      "open",
      "javascript:alert(1)",
      "--reason",
      "invalid evaluation url",
      "--json",
    ]);

    expect(output).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_ARGUMENT",
      },
    });
  });

  it("rejects conflicting tab open focus options", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run([
      "tabs",
      "open",
      "https://example.com/",
      "--reason",
      "conflicting focus options",
      "--background",
      "--foreground",
      "--json",
    ]);

    expect(output).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_ARGUMENT",
      },
    });
  });
});

describe("NativeHostService", function () {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "browser-connector-home-"));
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
  });

  it("routes IPC requests through the Native Host native messaging connection", async () => {
    const extensionToHost = new PassThrough();
    const hostToExtension = new PassThrough();
    const service = new NativeHostService(
      new ConfigRepository(homeDir),
      new NativeMessagingConnection(extensionToHost, hostToExtension),
    );
    await service.run();
    writeNativeMessage(extensionToHost, {
      kind: "extension.ready",
      browserInstanceId: "browser-test",
      extensionVersion: "0.1.0",
      protocolVersion: 1,
      capabilities: SUPPORTED_BROWSER_IPC_COMMANDS,
    });

    const client = new BrowserConnectorClient(
      resolveBrowserConnectorIpcPath(homeDir),
    );
    const requestPromise = client.request<{ tabs: unknown[] }>("tabs.list");
    const extensionRequest = await readNativeMessage(hostToExtension);
    expect(extensionRequest).toMatchObject({
      kind: "request",
      command: "tabs.list",
    });
    expect(extensionRequest.requestId).toBeTypeOf("string");
    writeNativeMessage(extensionToHost, {
      kind: "response",
      requestId: extensionRequest.requestId,
      ok: true,
      data: {
        tabs: [
          {
            tabRef: "chrome-tab:2",
            title: "Native",
            url: "https://example.com/",
            active: true,
          },
        ],
      },
    });

    await expect(requestPromise).resolves.toMatchObject({
      tabs: [{ title: "Native" }],
    });
    await service.stop();
  });

  it("reports missing extension capabilities for stale unpacked extensions", async () => {
    const extensionToHost = new PassThrough();
    const hostToExtension = new PassThrough();
    const service = new NativeHostService(
      new ConfigRepository(homeDir),
      new NativeMessagingConnection(extensionToHost, hostToExtension),
    );
    await service.run();
    writeNativeMessage(extensionToHost, {
      kind: "extension.ready",
      browserInstanceId: "browser-test",
      extensionVersion: "0.1.0",
      capabilities: ["browser.status", "tabs.list"],
    });

    const client = new BrowserConnectorClient(
      resolveBrowserConnectorIpcPath(homeDir),
    );

    await expect(client.request("browser.status")).resolves.toMatchObject({
      connected: true,
      missingExtensionCapabilities: expect.arrayContaining(["tabs.open"]),
    });
    await service.stop();
  });
});

const startFakeServer = async (ipcPath: string): Promise<Server> => {
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

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
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const fakeResponse = (request: BrowserIpcRequest): BrowserIpcResponse => {
  switch (request.command) {
    case "tabs.list":
      return {
        id: request.id,
        ok: true,
        data: {
          tabs: [
            {
              tabRef: "chrome-tab:1",
              title: "Example",
              url: "https://example.com/",
              active: true,
            },
          ],
        },
      };
    case "tabs.get":
    case "tabs.selected":
      return {
        id: request.id,
        ok: true,
        data: {
          tabRef: "chrome-tab:1",
          title: "Example",
          url: "https://example.com/",
          active: true,
        },
      };
    case "tabs.claim":
      return {
        id: request.id,
        ok: true,
        data: {
          leaseId: "lease-1",
          tab: {
            tabRef: "chrome-tab:1",
            title: "Example",
            url: "https://example.com/",
            active: true,
          },
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
      };
    case "tabs.open":
      return {
        id: request.id,
        ok: true,
        data: {
          tabRef: "chrome-tab:3",
          title: "Opened",
          url: "https://example.com/",
          active: request.payload?.active !== false,
        },
      };
    case "page.snapshot":
      return {
        id: request.id,
        ok: true,
        data: {
          tab: {
            tabRef: "chrome-tab:1",
            title: "Example",
            url: "https://example.com/",
            active: true,
          },
          title: "Example",
          url: "https://example.com/",
          text: "Hello from the browser",
          links: [],
          buttons: [],
          inputs: [],
          truncated: false,
          warning: "untrusted-browser-page-content",
        },
      };
    case "page.screenshot":
      return {
        id: request.id,
        ok: true,
        data: {
          tab: {
            tabRef: "chrome-tab:1",
            title: "Example",
            url: "https://example.com/",
            active: true,
          },
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
          mimeType: "image/png",
        },
      };
    case "page.reload":
      return {
        id: request.id,
        ok: true,
        data: {
          tab: {
            tabRef: "chrome-tab:1",
            title: "Example",
            url: "https://example.com/",
            active: true,
          },
          action: "page.reload",
        },
      };
    case "tabs.finalize":
      return {
        id: request.id,
        ok: true,
        data: {
          finalized: true,
          leaseId: "lease-1",
        },
      };
    default:
      return {
        id: request.id,
        ok: false,
        error: {
          code: "INVALID_ARGUMENT",
          message: `Unexpected command: ${request.command}`,
          recoverable: false,
        },
      };
  }
};

const writeNativeMessage = (
  stream: PassThrough,
  message: Record<string, unknown>,
): void => {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.byteLength, 0);
  stream.write(Buffer.concat([header, body]));
};

const readNativeMessage = async (
  stream: PassThrough,
): Promise<NativeTestMessage> =>
  new Promise((resolve) => {
    let buffer = Buffer.alloc(0);
    stream.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.byteLength < 4) {
        return;
      }

      const messageLength = buffer.readUInt32LE(0);

      if (buffer.byteLength < messageLength + 4) {
        return;
      }

      resolve(
        JSON.parse(
          buffer.subarray(4, 4 + messageLength).toString("utf8"),
        ) as NativeTestMessage,
      );
    });
  });
