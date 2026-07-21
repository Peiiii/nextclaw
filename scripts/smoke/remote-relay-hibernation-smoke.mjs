#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  findFreePort,
  requestJson,
  rootDir,
  runOrThrow,
  waitForHealth,
  wranglerBin,
} from "./remote-relay-smoke-support.mjs";
import {
  assertOwnerRemoteAccess,
  assertRemoteShareLifecycle,
} from "./remote-relay/remote-relay-access-smoke.utils.mjs";
import {
  assertNoIdleRemoteWrites,
  assertStableRemoteInstance,
  claimAndVerifyStableDomain,
  loginRemoteSmokeCli,
  releaseAndVerifyCustomDomain,
  restartRemoteConnectorAcrossHome,
  startRemoteSmokeConnector,
  waitForDistinctRemoteInstance,
  waitForRemoteInstance,
} from "./remote-relay/remote-relay-instance-smoke.utils.mjs";
import {
  startPrimaryRemoteUiFixture,
  startSecondaryRemoteUiFixture,
} from "./remote-relay/remote-relay-local-ui-smoke.utils.mjs";

const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const workerConfig = resolve(workerDir, "wrangler.toml");

class RemoteRelaySmokeRunner {
  persistDir = mkdtempSync(resolve(tmpdir(), "nextclaw-remote-relay-smoke-"));
  nextclawHome = mkdtempSync(resolve(tmpdir(), "nextclaw-remote-home-"));
  restartedNextclawHome = mkdtempSync(
    resolve(tmpdir(), "nextclaw-remote-restarted-home-"),
  );
  envFile = resolve(this.persistDir, ".smoke.env");
  userEmail = `remote-smoke.${Date.now()}@example.com`;
  password = "Passw0rd!";
  domainPrefix = `remote-smoke-${Date.now().toString(36)}`;
  stableDomain = `${this.domainPrefix}.claw.cool`;
  backendPort = 0;
  uiPort = 0;
  base = "";
  apiBase = "";
  workerProcess = null;
  connectorProcess = null;
  secondaryConnectorProcess = null;
  primaryUiFixture = null;
  secondaryUiFixture = null;
  workerLogs = "";
  connectorLogs = "";

  captureWorkerLog = (chunk) => {
    this.workerLogs = `${this.workerLogs}${String(chunk ?? "")}`.slice(-20_000);
  };

  captureConnectorLog = (chunk) => {
    this.connectorLogs = `${this.connectorLogs}${String(chunk ?? "")}`.slice(
      -20_000,
    );
  };

  prepare = async () => {
    this.backendPort = await findFreePort();
    this.uiPort = await findFreePort();
    this.base = `http://127.0.0.1:${this.backendPort}`;
    this.apiBase = `${this.base}/v1`;
    this.primaryUiFixture = await startPrimaryRemoteUiFixture(this.uiPort);
    writeFileSync(
      this.envFile,
      [
        "AUTH_TOKEN_SECRET=smoke-token-secret-with-length-at-least-32",
        "DASHSCOPE_API_KEY=smoke-upstream-key",
        "DASHSCOPE_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1",
        "PLATFORM_AUTH_EMAIL_PROVIDER=console",
        "PLATFORM_AUTH_DEV_EXPOSE_CODE=true",
        "GLOBAL_FREE_USD_LIMIT=20",
        "REQUEST_FLAT_USD_PER_REQUEST=0.0002",
      ].join("\n"),
      "utf-8",
    );
  };

  startWorker = async () => {
    console.log("[remote-relay-smoke] apply local migrations...");
    runOrThrow(wranglerBin, [
      "d1",
      "migrations",
      "apply",
      "NEXTCLAW_PLATFORM_DB",
      "--local",
      "--config",
      workerConfig,
      "--persist-to",
      this.persistDir,
    ]);
    console.log("[remote-relay-smoke] start worker...");
    this.workerProcess = spawn(
      wranglerBin,
      [
        "dev",
        "--local",
        "--port",
        String(this.backendPort),
        "--host",
        this.stableDomain,
        "--config",
        workerConfig,
        "--env-file",
        this.envFile,
        "--persist-to",
        this.persistDir,
      ],
      {
        cwd: rootDir,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    this.workerProcess.stdout?.on("data", this.captureWorkerLog);
    this.workerProcess.stderr?.on("data", this.captureWorkerLog);
    await waitForHealth(`${this.base}/health`);
  };

  registerUser = async () => {
    const registerCode = await requestJson({
      method: "POST",
      url: `${this.base}/platform/auth/register/send-code`,
      body: { email: this.userEmail },
      expectedStatus: 202,
    });
    const debugCode = registerCode.body?.data?.debugCode;
    if (!debugCode) {
      throw new Error(
        `Missing debug register code: ${JSON.stringify(registerCode.body)}`,
      );
    }
    const registration = await requestJson({
      method: "POST",
      url: `${this.base}/platform/auth/register/complete`,
      body: { email: this.userEmail, code: debugCode, password: this.password },
      expectedStatus: 201,
    });
    const token = registration.body?.data?.token;
    if (!token) {
      throw new Error("Missing user token after registration.");
    }
    return token;
  };

  connectPrimaryInstance = async (token) => {
    loginRemoteSmokeCli({
      apiBase: this.apiBase,
      email: this.userEmail,
      password: this.password,
      home: this.nextclawHome,
    });
    this.connectorProcess = startRemoteSmokeConnector({
      apiBase: this.apiBase,
      home: this.nextclawHome,
      localOrigin: `http://127.0.0.1:${this.uiPort}`,
      name: "remote-hibernation-smoke",
      captureLog: this.captureConnectorLog,
    });
    const instance = await waitForRemoteInstance({
      base: this.base,
      token,
      label: "connector online",
      predicate: (items) =>
        items.find(
          (item) =>
            item.displayName === "remote-hibernation-smoke" &&
            item.status === "online",
        ) ?? null,
    });
    assertStableRemoteInstance(instance, this.uiPort);
    return instance;
  };

  verifyIdentityAndDomain = async (token, instance) => {
    console.log(
      "[remote-relay-smoke] restart from a different data home and verify identity reuse...",
    );
    this.connectorProcess = await restartRemoteConnectorAcrossHome({
      base: this.base,
      apiBase: this.apiBase,
      token,
      email: this.userEmail,
      password: this.password,
      originalConnector: this.connectorProcess,
      instance,
      home: this.restartedNextclawHome,
      localOrigin: `http://127.0.0.1:${this.uiPort}`,
      captureLog: this.captureConnectorLog,
    });

    console.log(
      "[remote-relay-smoke] start a second port and verify a distinct instance...",
    );
    const secondaryPort = await findFreePort();
    this.secondaryUiFixture =
      await startSecondaryRemoteUiFixture(secondaryPort);
    this.secondaryConnectorProcess = startRemoteSmokeConnector({
      apiBase: this.apiBase,
      home: this.restartedNextclawHome,
      localOrigin: `http://127.0.0.1:${secondaryPort}`,
      name: "remote-secondary-port-smoke",
      captureLog: this.captureConnectorLog,
    });
    const secondaryInstance = await waitForDistinctRemoteInstance({
      base: this.base,
      token,
      instanceId: instance.id,
    });

    console.log(
      "[remote-relay-smoke] claim a custom stable domain and enforce reservation/uniqueness...",
    );
    await claimAndVerifyStableDomain({
      base: this.base,
      token,
      instance,
      secondaryInstance,
      domainPrefix: this.domainPrefix,
      stableDomain: this.stableDomain,
    });
  };

  verifyAccess = async (token, instance) => {
    console.log(
      "[remote-relay-smoke] verify no heartbeat writes after idle...",
    );
    await assertNoIdleRemoteWrites({
      persistDir: this.persistDir,
      instanceId: instance.id,
    });
    console.log(
      "[remote-relay-smoke] open remote session and verify local bridge...",
    );
    const ownerAccess = await assertOwnerRemoteAccess({
      base: this.base,
      token,
      instance,
      stableDomain: this.stableDomain,
      backendPort: this.backendPort,
      persistDir: this.persistDir,
    });
    console.log(
      "[remote-relay-smoke] create share link and verify revocation closes existing shared session...",
    );
    await assertRemoteShareLifecycle({
      base: this.base,
      token,
      instanceId: instance.id,
      ownerSessionHostname: ownerAccess.ownerSessionHostname,
      backendPort: this.backendPort,
    });
    console.log(
      "[remote-relay-smoke] release the custom domain and preserve the default domain...",
    );
    await releaseAndVerifyCustomDomain({
      base: this.base,
      token,
      instance,
    });
  };

  verifyOfflineTransition = async (token, instanceId) => {
    console.log(
      "[remote-relay-smoke] stop connector and verify offline transition...",
    );
    this.connectorProcess?.kill("SIGTERM");
    await waitForRemoteInstance({
      base: this.base,
      token,
      label: "connector offline",
      predicate: (items) =>
        items.find(
          (item) => item.id === instanceId && item.status === "offline",
        ) ?? null,
    });
  };

  stopProcess = async (child) => {
    if (!child || child.exitCode !== null || child.killed) {
      return;
    }
    child.kill("SIGTERM");
    await new Promise((resolveWait) => setTimeout(resolveWait, 800));
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
  };

  cleanup = async () => {
    await this.stopProcess(this.connectorProcess);
    await this.stopProcess(this.secondaryConnectorProcess);
    await this.stopProcess(this.workerProcess);
    await this.secondaryUiFixture?.close();
    await this.primaryUiFixture?.close();
    rmSync(this.persistDir, { recursive: true, force: true });
    rmSync(this.nextclawHome, { recursive: true, force: true });
    rmSync(this.restartedNextclawHome, { recursive: true, force: true });
  };

  run = async () => {
    await this.prepare();
    try {
      await this.startWorker();
      console.log("[remote-relay-smoke] build affected CLI...");
      runOrThrow("pnpm", ["-C", "packages/nextclaw", "build"]);
      console.log(
        "[remote-relay-smoke] register smoke user via platform auth API...",
      );
      const token = await this.registerUser();
      console.log("[remote-relay-smoke] start real connector...");
      const instance = await this.connectPrimaryInstance(token);
      await this.verifyIdentityAndDomain(token, instance);
      await this.verifyAccess(token, instance);
      await this.verifyOfflineTransition(token, instance.id);
      console.log("[remote-relay-smoke] all checks passed.");
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}` +
          `\n[worker logs]\n${this.workerLogs}` +
          `\n[connector logs]\n${this.connectorLogs}`,
      );
    } finally {
      await this.cleanup();
    }
  };
}

new RemoteRelaySmokeRunner().run().catch((error) => {
  console.error(
    "[remote-relay-smoke] failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
