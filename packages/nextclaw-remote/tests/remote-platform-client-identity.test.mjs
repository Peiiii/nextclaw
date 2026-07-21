import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RemotePlatformClient } from "../dist/index.js";

const temporaryDirectories = [];

function createPlatformToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
  ).toString("base64url");
  return `nca.${payload}.signature`;
}

function createClient({ deviceIdentity, port = 55_667 }) {
  const dataDir = mkdtempSync(join(tmpdir(), "nextclaw-remote-identity-"));
  temporaryDirectories.push(dataDir);
  return {
    client: new RemotePlatformClient({
      loadConfig: () => ({
        providers: {
          nextclaw: {
            apiBase: "https://ai-gateway-api.nextclaw.io/v1",
            apiKey: createPlatformToken(),
          },
        },
        remote: {
          enabled: true,
          autoReconnect: true,
          deviceName: "Test Mac",
          platformApiBase: null,
        },
        ui: { port },
      }),
      getDataDir: () => dataDir,
      getPackageVersion: () => "0.3.12",
      resolvePlatformBase: () => "https://ai-gateway-api.nextclaw.io",
      resolveDeviceIdentity: () => deviceIdentity,
    }),
    dataDir,
  };
}

try {
  const firstHome = createClient({ deviceIdentity: "machine-a", port: 55_667 });
  const secondHome = createClient({
    deviceIdentity: "machine-a",
    port: 55_667,
  });
  const otherPort = createClient({ deviceIdentity: "machine-a", port: 18_792 });
  const otherDevice = createClient({
    deviceIdentity: "machine-b",
    port: 55_667,
  });

  const firstContext = firstHome.client.resolveRunContext({});
  assert.match(firstContext.deviceInstallId, /^v2-[a-f0-9]{64}$/);
  assert.equal(
    secondHome.client.resolveRunContext({}).deviceInstallId,
    firstContext.deviceInstallId,
  );
  assert.equal(
    firstHome.client.resolveRunContext({}).deviceInstallId,
    firstContext.deviceInstallId,
  );
  assert.notEqual(
    otherPort.client.resolveRunContext({}).deviceInstallId,
    firstContext.deviceInstallId,
  );
  assert.notEqual(
    otherDevice.client.resolveRunContext({}).deviceInstallId,
    firstContext.deviceInstallId,
  );

  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      ok: true,
      data: {
        instance: {
          id: "instance-1",
          instanceInstallId: firstContext.deviceInstallId,
          displayName: firstContext.displayName,
          platform: "darwin",
          appVersion: "0.3.12",
          localOrigin: firstContext.localOrigin,
          status: "offline",
          lastSeenAt: "2026-07-20T00:00:00.000Z",
          createdAt: "2026-07-20T00:00:00.000Z",
          updatedAt: "2026-07-20T00:00:00.000Z",
        },
      },
    });
  };
  try {
    const registered = await firstHome.client.registerDevice({
      platformBase: firstContext.platformBase,
      token: firstContext.token,
      deviceInstallId: firstContext.deviceInstallId,
      displayName: firstContext.displayName,
      localOrigin: firstContext.localOrigin,
    });
    assert.equal(registered.id, "instance-1");
    assert.equal(requestBody.instanceInstallId, firstContext.deviceInstallId);
    assert.equal(requestBody.identityVersion, 2);
    assert.match(requestBody.legacyInstanceInstallId, /^[a-f0-9-]{36}$/);
    assert.notEqual(
      requestBody.legacyInstanceInstallId,
      firstContext.deviceInstallId,
    );
    const persisted = JSON.parse(
      readFileSync(join(firstHome.dataDir, "remote/device.json"), "utf-8"),
    );
    assert.equal(
      persisted.deviceInstallId,
      requestBody.legacyInstanceInstallId,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("[remote-platform-client-identity] passed");
} finally {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
}
