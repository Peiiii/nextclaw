import { spawn } from "node:child_process";
import {
  nextclawCli,
  queryLocalD1,
  requestJson,
  rootDir,
  runOrThrow,
  waitFor,
} from "../remote-relay-smoke-support.mjs";

export function loginRemoteSmokeCli({ apiBase, email, password, home }) {
  runOrThrow(
    "node",
    [
      nextclawCli,
      "login",
      "--api-base",
      apiBase,
      "--email",
      email,
      "--password",
      password,
    ],
    { env: { ...process.env, NEXTCLAW_HOME: home } },
  );
}

export function startRemoteSmokeConnector({
  apiBase,
  home,
  localOrigin,
  name,
  captureLog,
}) {
  const child = spawn(
    "node",
    [
      nextclawCli,
      "remote",
      "connect",
      "--api-base",
      apiBase,
      "--local-origin",
      localOrigin,
      "--name",
      name,
      "--once",
    ],
    {
      cwd: rootDir,
      env: { ...process.env, NEXTCLAW_HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", captureLog);
  child.stderr?.on("data", captureLog);
  return child;
}

export async function waitForRemoteInstance({ base, token, predicate, label }) {
  return await waitFor(
    async () => {
      const response = await requestJson({
        method: "GET",
        url: `${base}/platform/remote/instances`,
        token,
        expectedStatus: 200,
      });
      const items = response.body?.data?.items ?? [];
      return predicate(items);
    },
    30_000,
    label,
  );
}

export function assertStableRemoteInstance(instance, uiPort) {
  if (!String(instance.instanceInstallId).match(/^v2-[a-f0-9]{64}$/)) {
    throw new Error(
      `Expected v2 device+port identity, got ${JSON.stringify(instance)}`,
    );
  }
  if (
    instance.localOrigin !== `http://127.0.0.1:${uiPort}` ||
    !instance.systemDomain?.endsWith(".claw.cool") ||
    !instance.systemDomainPrefix?.startsWith("i-") ||
    instance.customDomain !== null
  ) {
    throw new Error(
      `Expected explicit port and random default domain in instance view, got ${JSON.stringify(instance)}`,
    );
  }
}

export async function restartRemoteConnectorAcrossHome({
  base,
  apiBase,
  token,
  email,
  password,
  originalConnector,
  instance,
  home,
  localOrigin,
  captureLog,
}) {
  loginRemoteSmokeCli({ apiBase, email, password, home });
  originalConnector.kill("SIGTERM");
  await waitForRemoteInstance({
    base,
    token,
    label: "first connector offline before restart",
    predicate: (items) =>
      items.find(
        (item) => item.id === instance.id && item.status === "offline",
      ) ?? null,
  });
  const connector = startRemoteSmokeConnector({
    apiBase,
    home,
    localOrigin,
    name: "remote-hibernation-smoke",
    captureLog,
  });
  await waitForRemoteInstance({
    base,
    token,
    label: "same remote instance after cross-home restart",
    predicate: (items) =>
      items.length === 1 &&
      items[0]?.id === instance.id &&
      items[0]?.status === "online"
        ? items[0]
        : null,
  });
  return connector;
}

export async function waitForDistinctRemoteInstance({
  base,
  token,
  instanceId,
}) {
  return await waitForRemoteInstance({
    base,
    token,
    label: "distinct second-port instance",
    predicate: (items) => {
      const candidate = items.find(
        (item) =>
          item.displayName === "remote-secondary-port-smoke" &&
          item.status === "online",
      );
      return items.length === 2 && candidate && candidate.id !== instanceId
        ? candidate
        : null;
    },
  });
}

export async function claimAndVerifyStableDomain({
  base,
  token,
  instance,
  secondaryInstance,
  domainPrefix,
  stableDomain,
}) {
  const updatedDomain = await requestJson({
    method: "PUT",
    url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/domain`,
    token,
    body: { prefix: domainPrefix.toUpperCase() },
    expectedStatus: 200,
  });
  if (
    updatedDomain.body?.data?.instance?.customDomain !== stableDomain ||
    updatedDomain.body?.data?.instance?.customDomainExpiresAt !== null ||
    updatedDomain.body?.data?.instance?.systemDomain !== instance.systemDomain
  ) {
    throw new Error(
      `Expected normalized non-expiring domain claim, got ${JSON.stringify(updatedDomain.body)}`,
    );
  }
  for (const [prefix, expectedStatus] of [
    [domainPrefix, 409],
    ["remote", 409],
    ["bad_name", 400],
  ]) {
    await requestJson({
      method: "PUT",
      url: `${base}/platform/remote/instances/${encodeURIComponent(secondaryInstance.id)}/domain`,
      token,
      body: { prefix },
      expectedStatus,
    });
  }
}

export async function releaseAndVerifyCustomDomain({ base, token, instance }) {
  const released = await requestJson({
    method: "DELETE",
    url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/domain`,
    token,
    expectedStatus: 200,
  });
  const updated = released.body?.data?.instance;
  if (
    updated?.customDomain !== null ||
    updated?.customDomainPrefix !== null ||
    updated?.systemDomain !== instance.systemDomain
  ) {
    throw new Error(
      `Expected custom domain release to preserve the default domain, got ${JSON.stringify(released.body)}`,
    );
  }
}

export async function assertNoIdleRemoteWrites({ persistDir, instanceId }) {
  const escapedId = instanceId.replaceAll("'", "''");
  const sql = `SELECT status, last_seen_at, updated_at FROM remote_devices WHERE id = '${escapedId}'`;
  const [before] = queryLocalD1({ persistDir, sql });
  if (!before || before.status !== "online") {
    throw new Error(
      `Expected online remote device row, got ${JSON.stringify(before)}`,
    );
  }
  await new Promise((resolveSleep) => setTimeout(resolveSleep, 18_000));
  const [after] = queryLocalD1({ persistDir, sql });
  if (!after || after.status !== "online") {
    throw new Error(
      `Expected online remote device row after idle, got ${JSON.stringify(after)}`,
    );
  }
  if (
    after.last_seen_at !== before.last_seen_at ||
    after.updated_at !== before.updated_at
  ) {
    throw new Error(
      `Expected no heartbeat-driven DB writes while idle, before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`,
    );
  }
}
