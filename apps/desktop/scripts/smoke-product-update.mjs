#!/usr/bin/env node
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { createServer as createNetServer, Socket } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareLocalUpdateChannelArtifacts } from "./update/services/local-update-channel-artifacts.service.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(desktopDir, "..", "..");
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const installedDesktopSeedBundlePath = "/Applications/NextClaw Desktop.app/Contents/Resources/update/seed-product-bundle.zip";
const desktopSeedBundlePath = resolve(desktopDir, "build", "update", "seed-product-bundle.zip");
const stableVersion = "0.17.7";
const betaVersion = "0.17.11";

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function shouldUseShell(command) {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
      shell: shouldUseShell(command)
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} ${args.join(" ")} failed with exit code ${String(code)}`));
    });
  });
}

function isPortAvailable(portToCheck, host) {
  return new Promise((resolveAvailable) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen(portToCheck, host, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

function isPortOccupied(portToCheck, host) {
  return new Promise((resolveOccupied) => {
    const socket = new Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveOccupied(value);
    };

    socket.setTimeout(250, () => finalize(false));
    socket.once("connect", () => finalize(true));
    socket.once("error", (error) => {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        finalize(false);
        return;
      }
      finalize(true);
    });

    socket.connect(portToCheck, host);
  });
}

async function resolveFreePort(startPort, host = "127.0.0.1", scanLimit = 50) {
  let port = startPort;
  for (let index = 0; index < scanLimit; index += 1) {
    const occupied = await isPortOccupied(port, host);
    if (!occupied && (await isPortAvailable(port, host))) {
      return port;
    }
    port += 1;
  }
  throw new Error(`Unable to reserve a free port from ${startPort} on ${host}.`);
}

async function waitForDesktopPageTarget(cdpPort, timeoutMs = 120_000) {
  const startAt = Date.now();
  let lastError = null;
  while (Date.now() - startAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        if (Array.isArray(targets) && targets.some((target) => target?.type === "page")) {
          return;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(
    `Timed out waiting for an Electron page target on port ${cdpPort}: ${String(lastError ?? "no page target created")}`
  );
}

async function waitForDesktopBrowser(cdpPort, timeoutMs = 120_000) {
  const startAt = Date.now();
  let lastError = null;
  while (Date.now() - startAt < timeoutMs) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw new Error(`Timed out waiting for Electron CDP on port ${cdpPort}: ${String(lastError)}`);
}

async function waitForDesktopPage(browser, timeoutMs = 120_000) {
  const startAt = Date.now();
  while (Date.now() - startAt < timeoutMs) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (page.isClosed()) {
          continue;
        }
        const hasDesktopApi = await page.evaluate(() => Boolean(window.nextclawDesktop?.getUpdateState)).catch(() => false);
        if (hasDesktopApi) {
          return page;
        }
      }
    }
    await sleep(500);
  }
  throw new Error("Timed out waiting for a desktop renderer page with window.nextclawDesktop.");
}

async function waitForSnapshot(page, predicate, timeoutMs, label) {
  const startAt = Date.now();
  let lastSnapshot = null;
  while (Date.now() - startAt < timeoutMs) {
    try {
      lastSnapshot = await page.evaluate(async () => await window.nextclawDesktop.getUpdateState());
      if (predicate(lastSnapshot)) {
        return lastSnapshot;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error(`${label}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function closeDesktopWindow(page) {
  try {
    await page.evaluate(() => window.close());
  } catch {}
  try {
    await page.waitForEvent("close", { timeout: 15_000 });
  } catch {}
}

const tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-desktop-update-smoke-"));
const serverRoot = join(tempRoot, "server-root");
const runtimeHome = join(tempRoot, "runtime-home");
const desktopData = join(tempRoot, "desktop-data");
const electronStdoutPath = join(tempRoot, "electron.stdout.log");
const electronStderrPath = join(tempRoot, "electron.stderr.log");

let browser = null;
let page = null;
let electronProcess = null;
let httpServer = null;
let seededDesktopBundle = false;

try {
  await mkdir(serverRoot, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await mkdir(desktopData, { recursive: true });

  console.log("[desktop-update-smoke] building desktop main entry");
  await runCommand(pnpmBin, ["-C", "apps/desktop", "build:main"]);

  if (!existsSync(installedDesktopSeedBundlePath)) {
    throw new Error(`Installed desktop seed bundle not found: ${installedDesktopSeedBundlePath}`);
  }
  await mkdir(dirname(desktopSeedBundlePath), { recursive: true });
  copyFileSync(installedDesktopSeedBundlePath, desktopSeedBundlePath);
  seededDesktopBundle = true;

  console.log(`[desktop-update-smoke] preparing stable seed bundle ${stableVersion}`);
  const keyPair = generateKeyPairSync("ed25519");
  const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const manifestPort = await resolveFreePort(43010);
  const cdpPort = await resolveFreePort(9222);
  const manifestBaseUrl = `http://127.0.0.1:${manifestPort}/desktop-updates`;

  const stableDir = join(serverRoot, "desktop-updates", "stable");
  const betaDir = join(serverRoot, "desktop-updates", "beta");
  await mkdir(stableDir, { recursive: true });
  await mkdir(betaDir, { recursive: true });
  console.log(`[desktop-update-smoke] deriving beta bundle ${betaVersion} from ${stableVersion}`);
  const { stableBundlePath, betaBundlePath } = await prepareLocalUpdateChannelArtifacts({
    stableSeedBundlePath: installedDesktopSeedBundlePath,
    stableVersion,
    betaVersion,
    stableRoot: stableDir,
    betaRoot: betaDir,
    manifestBaseUrl,
    privateKey: keyPair.privateKey
  });
  const stableBundleFileName = basename(stableBundlePath);
  const betaBundleFileName = basename(betaBundlePath);

  httpServer = createHttpServer((request, response) => {
    const requestPath = request.url ? request.url.split("?")[0] : "/";
    const filePath = resolve(serverRoot, `.${requestPath}`);
    if (!filePath.startsWith(resolve(serverRoot))) {
      response.writeHead(403).end("forbidden");
      return;
    }
    try {
      const body = readFileSync(filePath);
      const contentType = filePath.endsWith(".json")
        ? "application/json"
        : filePath.endsWith(".zip")
          ? "application/zip"
          : "text/plain; charset=utf-8";
      response.writeHead(200, { "content-type": contentType });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(manifestPort, "127.0.0.1", resolveListen);
  });

  console.log(`[desktop-update-smoke] local update server: ${manifestBaseUrl}`);
  writeFileSync(electronStdoutPath, "", "utf8");
  writeFileSync(electronStderrPath, "", "utf8");
  electronProcess = spawn(
    pnpmBin,
    ["-C", "apps/desktop", "exec", "electron", ".", `--remote-debugging-port=${cdpPort}`],
    {
      cwd: workspaceRoot,
      env: {
        ...(() => {
          const nextEnv = { ...process.env };
          delete nextEnv.ELECTRON_RUN_AS_NODE;
          return nextEnv;
        })(),
        NEXTCLAW_HOME: runtimeHome,
        NEXTCLAW_DESKTOP_DATA_DIR: desktopData,
        NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL: manifestBaseUrl,
        NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY: publicKeyPem
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: shouldUseShell(pnpmBin)
    }
  );
  if (electronProcess.stdout) {
    electronProcess.stdout.on("data", (chunk) => {
      writeFileSync(electronStdoutPath, chunk, { flag: "a" });
      process.stdout.write(chunk);
    });
  }
  if (electronProcess.stderr) {
    electronProcess.stderr.on("data", (chunk) => {
      writeFileSync(electronStderrPath, chunk, { flag: "a" });
      process.stderr.write(chunk);
    });
  }

  await waitForDesktopPageTarget(cdpPort);
  browser = await waitForDesktopBrowser(cdpPort);
  page = await waitForDesktopPage(browser);
  const initialSnapshot = await waitForSnapshot(
    page,
    (snapshot) => snapshot?.currentVersion === stableVersion && snapshot?.channel === "stable",
    120_000,
    `Desktop did not bootstrap stable bundle ${stableVersion}`
  );

  const stableCheckSnapshot = await page.evaluate(async () => await window.nextclawDesktop.checkForUpdates());
  assert(
    stableCheckSnapshot.status === "up-to-date" && stableCheckSnapshot.currentVersion === stableVersion,
    `Expected stable channel to be up-to-date on ${stableVersion}, got ${JSON.stringify(stableCheckSnapshot)}`
  );

  const betaChannelSnapshot = await page.evaluate(async () => await window.nextclawDesktop.updateChannel("beta"));
  assert(
    betaChannelSnapshot.status === "update-available" &&
      betaChannelSnapshot.channel === "beta" &&
      betaChannelSnapshot.availableVersion === betaVersion,
    `Expected beta channel switch to expose ${betaVersion}, got ${JSON.stringify(betaChannelSnapshot)}`
  );

  const downloadedSnapshot = await page.evaluate(async () => await window.nextclawDesktop.downloadUpdate());
  assert(
    downloadedSnapshot.status === "downloaded" &&
      downloadedSnapshot.downloadedVersion === betaVersion &&
      downloadedSnapshot.availableVersion === betaVersion,
    `Expected downloaded beta update ${betaVersion}, got ${JSON.stringify(downloadedSnapshot)}`
  );

  try {
    await page.evaluate(async () => await window.nextclawDesktop.applyDownloadedUpdate());
  } catch {}
  await sleep(2_000);

  await waitForDesktopPageTarget(cdpPort);
  browser = await waitForDesktopBrowser(cdpPort);
  page = await waitForDesktopPage(browser);

  const appliedSnapshot = await waitForSnapshot(
    page,
    (snapshot) =>
      snapshot?.currentVersion === betaVersion &&
      snapshot?.channel === "beta" &&
      snapshot?.downloadedVersion === null &&
      snapshot?.status !== "failed",
    120_000,
    `Desktop did not relaunch on applied beta bundle ${betaVersion}`
  );

  const stableDowngradeSnapshot = await page.evaluate(async () => await window.nextclawDesktop.updateChannel("stable"));
  assert(
    stableDowngradeSnapshot.channel === "stable" &&
      stableDowngradeSnapshot.currentVersion === betaVersion &&
      stableDowngradeSnapshot.status === "up-to-date" &&
      stableDowngradeSnapshot.availableVersion === null,
    `Expected switching back to stable to avoid forced downgrade, got ${JSON.stringify(stableDowngradeSnapshot)}`
  );

  const statePath = join(desktopData, "launcher", "state.json");
  const pointerPath = join(desktopData, "current.json");
  const persistedState = JSON.parse(readFileSync(statePath, "utf8"));
  const currentPointer = JSON.parse(readFileSync(pointerPath, "utf8"));
  assert(persistedState.channel === "stable", `Expected persisted channel to be stable after switch-back, got ${persistedState.channel}`);
  assert(persistedState.currentVersion === betaVersion, `Expected persisted currentVersion ${betaVersion}, got ${persistedState.currentVersion}`);
  assert(persistedState.downloadedVersion === null, `Expected downloadedVersion to be cleared after apply, got ${persistedState.downloadedVersion}`);
  assert(currentPointer.version === betaVersion, `Expected current pointer ${betaVersion}, got ${currentPointer.version}`);

  console.log(
    JSON.stringify(
      {
        stableVersion,
        betaVersion,
        manifestBaseUrl,
        initial: initialSnapshot,
        stableCheck: stableCheckSnapshot,
        betaChannelUpdate: betaChannelSnapshot,
        downloaded: downloadedSnapshot,
        applied: appliedSnapshot,
        switchBackStable: stableDowngradeSnapshot,
        launcherStatePath: statePath,
        currentPointerPath: pointerPath
      },
      null,
      2
    )
  );

  await closeDesktopWindow(page);
  await browser.close();
  browser = null;
  page = null;
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  if (httpServer) {
    await new Promise((resolveClose) => httpServer.close(() => resolveClose()));
  }
  if (electronProcess && !electronProcess.killed) {
    try {
      electronProcess.kill("SIGTERM");
    } catch {}
  }
  if (seededDesktopBundle) {
    await rm(desktopSeedBundlePath, { force: true });
  }
  await sleep(1_000);
  rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
