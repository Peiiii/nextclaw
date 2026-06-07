import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBrowserConnectorApp } from "../src/app/browser-connector-app.js";
import { resolveBrowserConnectorIpcPath } from "../src/utils/ipc-path.utils.js";
import { redactBrowserUrl } from "../src/utils/url-redaction.utils.js";
import type {
  BrowserIpcRequest,
  BrowserIpcResponse,
} from "../src/types/browser-connector-json.types.js";
import { SUPPORTED_BROWSER_IPC_COMMANDS } from "../src/types/browser-connector-json.types.js";

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
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(output).toEqual({
      ok: true,
      output: packageJson.version,
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
    const interactiveSnapshot = await app.run([
      "page",
      "snapshot",
      "--lease",
      "lease-1",
      "--interactive",
      "--json",
    ]);
    const located = await app.run([
      "page",
      "locate",
      "--lease",
      "lease-1",
      "--text",
      "Create",
      "--json",
    ]);
    const clickedByRef = await app.run([
      "page",
      "click",
      "--lease",
      "lease-1",
      "--ref",
      "i2",
      "--reason",
      "submit generated song request",
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
    expect(interactiveSnapshot).toMatchObject({
      ok: true,
      snapshot: {
        interactive: [
          {
            ref: "i1",
            text: "Create",
            role: "link",
          },
          {
            ref: "i2",
            text: "Create",
            role: "button",
          },
        ],
      },
    });
    expect(located).toMatchObject({
      ok: true,
      locate: {
        query: "Create",
        matches: [
          {
            ref: "i1",
            text: "Create",
          },
          {
            ref: "i2",
            text: "Create",
          },
        ],
      },
    });
    expect(clickedByRef).toMatchObject({
      ok: true,
      action: {
        action: "page.click",
        ref: "i2",
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

});

describe("BrowserConnectorApp browser action validation", function () {
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

  it("asks the extension to reload and waits for a new browser instance", async () => {
    fakeServer = await startFakeServer(resolveBrowserConnectorIpcPath(homeDir));
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run([
      "extension",
      "reload",
      "--reason",
      "refresh unpacked extension after local build",
      "--timeout-ms",
      "2000",
      "--json",
    ]);

    expect(output).toMatchObject({
      ok: true,
      extensionReload: {
        action: "extension.reload",
        reloaded: true,
        before: { browserInstanceId: "browser-before-reload" },
        after: { browserInstanceId: "browser-after-reload" },
      },
    });
  });

  it("requires a selector or ref for click actions", async () => {
    const app = createBrowserConnectorApp(homeDir);
    const output = await app.run([
      "page",
      "click",
      "--lease",
      "lease-1",
      "--reason",
      "click target",
      "--json",
    ]);

    expect(output).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_ARGUMENT",
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

const startFakeServer = async (ipcPath: string): Promise<Server> => {
  const state = new FakeBrowserConnectorState();
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

      const request = JSON.parse(buffer.slice(0, newlineIndex)) as BrowserIpcRequest;
      socket.end(`${JSON.stringify(fakeResponse(request, state))}\n`);
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

const fakeResponse = (
  request: BrowserIpcRequest,
  state: FakeBrowserConnectorState,
): BrowserIpcResponse => {
  switch (request.command) {
    case "browser.status":
      return fakeBrowserStatusResponse(request, state);
    case "extension.reload":
      return fakeExtensionReloadResponse(request, state);
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
          interactive: request.payload?.interactive
            ? [
                {
                  ref: "i1",
                  selector: "a[href='/create']",
                  text: "Create",
                  role: "link",
                  kind: "link",
                  tagName: "a",
                  visible: true,
                  disabled: false,
                  unique: true,
                },
                {
                  ref: "i2",
                  selector: "div:nth-of-type(4) > div:nth-of-type(2)",
                  text: "Create",
                  role: "button",
                  kind: "button",
                  tagName: "div",
                  boundingBox: { x: 24, y: 704, width: 180, height: 48 },
                  visible: true,
                  disabled: false,
                  unique: true,
                },
              ]
            : [],
          truncated: false,
          warning: "untrusted-browser-page-content",
        },
      };
    case "page.locate":
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
          query: request.payload?.text,
          matches: [
            {
              ref: "i1",
              selector: "a[href='/create']",
              text: "Create",
              role: "link",
              kind: "link",
              tagName: "a",
            },
            {
              ref: "i2",
              selector: "div:nth-of-type(4) > div:nth-of-type(2)",
              text: "Create",
              role: "button",
              kind: "button",
              tagName: "div",
            },
          ],
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
    case "page.click":
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
          action: request.command,
          ref: request.payload?.ref,
          selector: request.payload?.selector,
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

const fakeBrowserStatusResponse = (
  request: BrowserIpcRequest,
  state: FakeBrowserConnectorState,
): BrowserIpcResponse => ({
  id: request.id,
  ok: true,
  data: {
    connected: true,
    browserInstanceId: state.isExtensionReloaded()
      ? "browser-after-reload"
      : "browser-before-reload",
    extensionVersion: "0.1.2",
    protocolVersion: 1,
    extensionCapabilities: SUPPORTED_BROWSER_IPC_COMMANDS,
    missingExtensionCapabilities: [],
    activeLeaseCount: 0,
    nativeHostName: "com.nextclaw.browserconnector",
  },
});

const fakeExtensionReloadResponse = (
  request: BrowserIpcRequest,
  state: FakeBrowserConnectorState,
): BrowserIpcResponse => {
  state.markExtensionReloaded();

  return {
    id: request.id,
    ok: true,
    data: {
      action: "extension.reload",
      reloading: true,
      requestedAt: "2026-06-07T00:00:00.000Z",
      extensionVersion: "0.1.2",
    },
  };
};

class FakeBrowserConnectorState {
  private extensionReloaded = false;

  isExtensionReloaded = (): boolean => this.extensionReloaded;

  markExtensionReloaded = (): void => {
    this.extensionReloaded = true;
  };
}
