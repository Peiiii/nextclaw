import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowserConnectorClient } from "../src/services/browser-connector-client.service.js";
import { ConfigRepository } from "../src/repositories/config.repository.js";
import { NativeHostService } from "../src/services/native-host.service.js";
import { resolveBrowserConnectorIpcPath } from "../src/utils/ipc-path.utils.js";
import { NativeMessagingConnection } from "../src/utils/native-messaging-protocol.utils.js";
import { SUPPORTED_BROWSER_IPC_COMMANDS } from "../src/types/browser-connector-json.types.js";

type NativeTestMessage = Record<string, unknown> & {
  requestId?: string;
};

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

    const client = new BrowserConnectorClient(resolveBrowserConnectorIpcPath(homeDir));
    const requestPromise = client.request<{ tabs: unknown[] }>("tabs.list");
    const extensionRequest = await readNativeMessage(hostToExtension);
    expect(extensionRequest).toMatchObject({ kind: "request", command: "tabs.list" });
    expect(extensionRequest.requestId).toBeTypeOf("string");
    writeNativeMessage(extensionToHost, {
      kind: "response",
      requestId: extensionRequest.requestId,
      ok: true,
      data: {
        tabs: [{ tabRef: "chrome-tab:2", title: "Native", url: "https://example.com/", active: true }],
      },
    });

    await expect(requestPromise).resolves.toMatchObject({ tabs: [{ title: "Native" }] });
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

    const client = new BrowserConnectorClient(resolveBrowserConnectorIpcPath(homeDir));
    await expect(client.request("browser.status")).resolves.toMatchObject({
      connected: true,
      missingExtensionCapabilities: expect.arrayContaining(["tabs.open"]),
    });
    await service.stop();
  });
});

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
      if (buffer.byteLength < 4) return;

      const messageLength = buffer.readUInt32LE(0);
      if (buffer.byteLength < messageLength + 4) return;

      resolve(
        JSON.parse(
          buffer.subarray(4, 4 + messageLength).toString("utf8"),
        ) as NativeTestMessage,
      );
    });
  });
