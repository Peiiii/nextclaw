#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { UpdateVerificationFixtureManager } from "./managers/update-verification-fixture.manager.mjs";
import {
  formatUpdateVerificationDuration,
  runUpdateVerificationCommand,
  runUpdateVerificationStage
} from "./utils/update-verification-command.utils.mjs";
import { parseOptions, printHelp } from "./verify-update-cli.mjs";

const workspaceRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const nextclawPackageRoot = join(workspaceRoot, "packages/nextclaw");
const nextclawPackageJsonPath = join(nextclawPackageRoot, "package.json");
const cleanupWatchdogPath = join(workspaceRoot, "scripts/dev/verify-update-cleanup.mjs");
const initialRuntimeTimeoutMs = 90_000;
const automaticDiscoveryTimeoutMs = 45_000;
const verificationIntervalMs = 15_000;

function quotePowerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

class LocalUpdateVerificationHarness {
  constructor(options) {
    this.options = options;
    mkdirSync(join(workspaceRoot, "tmp"), { recursive: true });
    this.rootDir = mkdtempSync(join(workspaceRoot, "tmp/nextclaw-update-verification-"));
    this.baselineRoot = join(this.rootDir, "baseline");
    this.homeDir = join(this.rootDir, "home");
    this.runDir = join(this.rootDir, "run");
    this.keepMarkerPath = join(this.rootDir, ".keep");
    this.serviceStatePath = join(this.runDir, "service.json");
    this.updateStatePath = join(this.homeDir, "launcher/npm-runtime-update-state.json");
    this.currentPointerPath = join(this.homeDir, "launcher/runtime-bundles/current.json");
    this.baselineLauncherPath = join(this.baselineRoot, "dist/cli/launcher/index.js");
    this.observedServicePids = new Set();
    this.cleanupStarted = false;
    this.updateObserved = false;
    if (this.options.keep) {
      writeFileSync(this.keepMarkerPath, "", "utf8");
    }
  }

  run = async () => {
    this.startCleanupWatchdog();
    this.installSignalHandlers();
    try {
      await this.prepare();
      await this.startBaseline();
      await this.waitForAutomaticUpdateDiscovery();
      this.printInstructions();
      await this.monitorUpdate();
    } catch (error) {
      this.cleanup({ keepFiles: true });
      throw error;
    }
  };

  startCleanupWatchdog = () => {
    const watchdog = spawn(process.execPath, [cleanupWatchdogPath, String(process.pid), this.rootDir], {
      detached: true,
      stdio: "ignore"
    });
    watchdog.unref();
  };

  installSignalHandlers = () => {
    const handleSignal = () => {
      this.cleanup({ keepFiles: this.options.keep });
      process.exit(0);
    };
    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);
  };

  prepare = async () => {
    const prepareStartedAt = Date.now();
    const packageJson = JSON.parse(readFileSync(nextclawPackageJsonPath, "utf8"));
    this.candidateVersion = String(packageJson.version ?? "").trim();
    this.baselineVersion = this.resolveBaselineVersion(this.candidateVersion);
    this.channel = this.candidateVersion.includes("-") ? "beta" : "stable";
    this.port = this.options.port ?? await this.reserveAvailablePort();
    this.baseUrl = `http://127.0.0.1:${this.port}`;

    console.log(`[dev:verify-update] Temporary directory: ${this.rootDir}`);
    const fixture = new UpdateVerificationFixtureManager({
      candidateVersion: this.candidateVersion,
      channel: this.channel,
      rebuild: this.options.rebuild,
      runRoot: this.rootDir
    }).prepare();
    this.bundlePath = fixture.bundlePath;
    this.fixtureCacheHit = fixture.cacheHit;
    this.manifestPath = fixture.manifestPath;
    this.publicKeyPath = fixture.publicKeyPath;
    this.extractBaseline();
    this.writeInitialUpdateState();
    this.prepareDurationMs = Date.now() - prepareStartedAt;
  };

  resolveBaselineVersion = (candidateVersion) => {
    const match = /^(\d+\.\d+\.\d+)(?:-(.+))?$/.exec(candidateVersion);
    if (!match) {
      throw new Error(`Unsupported NextClaw package version: ${candidateVersion || "empty"}`);
    }
    if (!match[2]) {
      return `${match[1]}-dev.0`;
    }
    if (match[2] === "0") {
      throw new Error(`Cannot derive a lower local baseline from prerelease ${candidateVersion}.`);
    }
    return `${match[1]}-0`;
  };

  reserveAvailablePort = async () => {
    const server = createServer();
    await new Promise((resolvePromise, rejectPromise) => {
      server.once("error", rejectPromise);
      server.listen(0, "127.0.0.1", resolvePromise);
    });
    const address = server.address();
    await new Promise((resolvePromise, rejectPromise) => {
      server.close((error) => error ? rejectPromise(error) : resolvePromise());
    });
    if (!address || typeof address === "string") {
      throw new Error("Failed to reserve an available local port.");
    }
    return address.port;
  };

  extractBaseline = () => {
    runUpdateVerificationStage(`Extracting isolated baseline ${this.baselineVersion}`, () => {
      const extractionRoot = join(this.rootDir, "baseline-extraction");
      rmSync(extractionRoot, { recursive: true, force: true });
      mkdirSync(extractionRoot, { recursive: true });
      if (process.platform === "win32") {
        runUpdateVerificationCommand("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Expand-Archive -LiteralPath ${quotePowerShellString(this.bundlePath)} -DestinationPath ${quotePowerShellString(extractionRoot)} -Force`
        ], { cwd: workspaceRoot });
      } else {
        runUpdateVerificationCommand("unzip", ["-q", this.bundlePath, "-d", extractionRoot], { cwd: workspaceRoot });
      }

      const extractedRuntimeRoot = join(extractionRoot, "bundle/runtime");
      if (!existsSync(join(extractedRuntimeRoot, "dist/cli/launcher/index.js"))) {
        throw new Error("The prepared update bundle does not contain the baseline launcher.");
      }
      rmSync(this.baselineRoot, { recursive: true, force: true });
      renameSync(extractedRuntimeRoot, this.baselineRoot);
      rmSync(extractionRoot, { recursive: true, force: true });

      const baselinePackageJsonPath = join(this.baselineRoot, "package.json");
      const baselinePackageJson = JSON.parse(readFileSync(baselinePackageJsonPath, "utf8"));
      baselinePackageJson.version = this.baselineVersion;
      writeFileSync(baselinePackageJsonPath, `${JSON.stringify(baselinePackageJson, null, 2)}\n`, "utf8");
    });
  };

  writeInitialUpdateState = () => {
    this.initialUpdateCheckAt = new Date().toISOString();
    mkdirSync(dirname(this.updateStatePath), { recursive: true });
    writeFileSync(this.updateStatePath, `${JSON.stringify({
      channel: this.channel,
      currentVersion: null,
      previousVersion: null,
      candidateVersion: null,
      candidateLaunchCount: 0,
      lastKnownGoodVersion: null,
      badVersions: [],
      lastUpdateCheckAt: this.initialUpdateCheckAt,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null
    }, null, 2)}\n`, "utf8");
  };

  createRuntimeEnv = () => {
    const env = { ...process.env };
    env.NEXTCLAW_HOME = this.homeDir;
    env.NEXTCLAW_RUN_HOME = this.runDir;
    env.NEXTCLAW_UPDATE_MANIFEST_URL = pathToFileURL(this.manifestPath).toString();
    env.NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH = this.publicKeyPath;
    env.NEXTCLAW_UPDATE_VERIFICATION_MODE = "1";
    env.NEXTCLAW_UPDATE_VERIFICATION_INTERVAL_MS = String(verificationIntervalMs);
    delete env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST;
    return env;
  };

  startBaseline = async () => {
    const args = [
      this.baselineLauncherPath,
      "start",
      "--ui-port",
      String(this.port),
      "--start-timeout",
      "60000"
    ];
    if (this.options.open) {
      args.push("--open");
    }

    console.log("[dev:verify-update] Starting the isolated baseline service...");
    runUpdateVerificationCommand(process.execPath, args, {
      cwd: workspaceRoot,
      env: this.createRuntimeEnv(),
      timeout: 120_000
    });
    await this.waitForInitialRuntime();
  };

  waitForInitialRuntime = async () => {
    const deadline = Date.now() + initialRuntimeTimeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const version = await this.fetchProductVersion();
        if (version !== this.baselineVersion) {
          throw new Error(`Expected baseline ${this.baselineVersion}, received ${version}.`);
        }
        const state = this.readServiceState();
        if (!state?.pid) {
          throw new Error("The managed service state does not contain a PID.");
        }
        this.initialServicePid = state.pid;
        this.observedServicePids.add(state.pid);
        return;
      } catch (error) {
        lastError = error;
        await delay(500);
      }
    }
    throw new Error(`Baseline did not become ready: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  };

  waitForAutomaticUpdateDiscovery = async () => {
    const deadline = Date.now() + automaticDiscoveryTimeoutMs;
    let lastSnapshot = null;
    while (Date.now() < deadline) {
      const state = this.readServiceState();
      if (state?.pid && state.pid !== this.initialServicePid) {
        throw new Error(
          `The service restarted before automatic update discovery: ${this.initialServicePid} -> ${state.pid}.`
        );
      }
      try {
        lastSnapshot = await this.fetchUpdateSnapshot();
        if (
          lastSnapshot.availableVersion === this.candidateVersion &&
          lastSnapshot.lastCheckedAt &&
          lastSnapshot.lastCheckedAt !== this.initialUpdateCheckAt
        ) {
          this.automaticDiscoveryDurationMs = Date.now() - Date.parse(this.initialUpdateCheckAt);
          return;
        }
      } catch {
        // The isolated UI can be briefly unavailable while the baseline starts.
      }
      await delay(500);
    }
    throw new Error(
      `The running baseline did not discover ${this.candidateVersion} automatically. Last snapshot: ${JSON.stringify(lastSnapshot)}`
    );
  };

  printInstructions = () => {
    console.log("\n[dev:verify-update] Local update verification is ready.");
    console.log(`  Baseline:  ${this.baselineVersion} (PID ${this.initialServicePid})`);
    console.log(`  Candidate: ${this.candidateVersion}`);
    console.log(`  UI:        ${this.baseUrl}`);
    console.log(`  Updates:   ${this.baseUrl}/updates`);
    console.log(`  Workspace: ${this.rootDir}`);
    console.log(
      `  Discovery: automatic after ${formatUpdateVerificationDuration(this.automaticDiscoveryDurationMs)} without restart`
    );
    console.log(
      `  Fixture:   ${this.fixtureCacheHit ? "cache hit" : "rebuilt"} (${formatUpdateVerificationDuration(this.prepareDurationMs)})`
    );
    console.log("\nVerify in the UI:");
    console.log("  1. Confirm the header shows the baseline version.");
    console.log("  2. Confirm the candidate download action is already visible without a restart or manual check.");
    console.log("  3. Download and apply the candidate yourself.");
    console.log("  4. Wait for reconnect and confirm the candidate version appears.");
    console.log("\nPress Ctrl+C after verification to stop and clean up.\n");
  };

  monitorUpdate = async () => {
    while (true) {
      await delay(1_000);
      try {
        const state = this.readServiceState();
        if (state?.pid) {
          this.observedServicePids.add(state.pid);
        }
        const version = await this.fetchProductVersion();
        if (version !== this.baselineVersion && version !== this.candidateVersion) {
          throw new Error(`Observed unexpected product version ${version}.`);
        }
        if (!this.updateObserved && version === this.candidateVersion) {
          await this.assertCompletedUpdate(state);
          this.updateObserved = true;
          console.log("\n[dev:verify-update] Update verified successfully.");
          console.log(`  Version: ${this.candidateVersion}`);
          console.log(`  PID:     ${this.initialServicePid} -> ${state.pid}`);
          console.log(`  Pointer: ${this.currentPointerPath}`);
          console.log(`  Skills:  ${this.builtInSkillCount} available built-ins, including visualize-output`);
          console.log("  The service remains available for manual inspection. Press Ctrl+C when finished.\n");
        }
      } catch (error) {
        if (error instanceof Error && (error.message.startsWith("Observed unexpected") || error.message.startsWith("Candidate"))) {
          throw error;
        }
      }
    }
  };

  assertCompletedUpdate = async (serviceState) => {
    if (!serviceState?.pid || serviceState.pid === this.initialServicePid) {
      throw new Error("Candidate is serving without a managed service PID change.");
    }
    if (!existsSync(this.currentPointerPath)) {
      throw new Error("Candidate is serving without a runtime bundle pointer.");
    }
    const pointer = JSON.parse(readFileSync(this.currentPointerPath, "utf8"));
    if (pointer.version !== this.candidateVersion) {
      throw new Error(`Candidate runtime pointer expected ${this.candidateVersion}, received ${String(pointer.version)}.`);
    }
    const skillRecords = await this.fetchSessionSkills();
    const builtInSkills = skillRecords.filter((skill) => skill?.source === "builtin" && skill.available === true);
    if (!builtInSkills.some((skill) => skill.name === "visualize-output")) {
      throw new Error("Candidate skill catalog is missing the available built-in visualize-output skill.");
    }
    this.builtInSkillCount = builtInSkills.length;
  };

  fetchProductVersion = async () => {
    const response = await fetch(`${this.baseUrl}/api/app/meta`, {
      headers: { accept: "application/json" },
      signal: globalThis.AbortSignal.timeout(2_000)
    });
    if (!response.ok) {
      throw new Error(`App meta returned HTTP ${response.status}.`);
    }
    const payload = await response.json();
    const productVersion = payload?.data?.productVersion ?? payload?.productVersion;
    if (typeof productVersion !== "string" || !productVersion.trim()) {
      throw new Error("App meta did not return productVersion.");
    }
    return productVersion.trim();
  };

  fetchUpdateSnapshot = async () => {
    const response = await fetch(`${this.baseUrl}/api/runtime/update`, {
      headers: { accept: "application/json" },
      signal: globalThis.AbortSignal.timeout(2_000)
    });
    if (!response.ok) {
      throw new Error(`Runtime update state returned HTTP ${response.status}.`);
    }
    const payload = await response.json();
    const snapshot = payload?.data ?? payload;
    if (!snapshot || typeof snapshot !== "object") {
      throw new Error("Runtime update state did not return a snapshot.");
    }
    return snapshot;
  };

  fetchSessionSkills = async () => {
    const response = await fetch(`${this.baseUrl}/api/ncp/sessions/draft-session/skills`, {
      headers: { accept: "application/json" },
      signal: globalThis.AbortSignal.timeout(2_000)
    });
    if (!response.ok) {
      throw new Error(`Candidate skill catalog returned HTTP ${response.status}.`);
    }
    const payload = await response.json();
    const records = payload?.data?.records ?? payload?.records;
    if (!Array.isArray(records)) {
      throw new Error("Candidate skill catalog did not return records.");
    }
    return records;
  };

  readServiceState = () => {
    if (!existsSync(this.serviceStatePath)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(this.serviceStatePath, "utf8"));
    } catch {
      return null;
    }
  };

  cleanup = ({ keepFiles }) => {
    if (this.cleanupStarted) {
      return;
    }
    this.cleanupStarted = true;
    console.log("\n[dev:verify-update] Stopping the isolated service...");

    if (keepFiles) {
      writeFileSync(this.keepMarkerPath, "", "utf8");
    }
    const state = this.readServiceState();
    if (state?.pid) {
      this.observedServicePids.add(state.pid);
    }

    for (const pid of this.observedServicePids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // The owned process has already stopped.
      }
    }

    if (keepFiles) {
      console.log(`[dev:verify-update] Kept verification files: ${this.rootDir}`);
      return;
    }
    rmSync(this.rootDir, { recursive: true, force: true });
    console.log("[dev:verify-update] Cleaned the temporary verification directory.");
  };
}

let options;
try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  console.error(`[dev:verify-update] ${error instanceof Error ? error.message : String(error)}`);
  printHelp();
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

const harness = new LocalUpdateVerificationHarness(options);
harness.run().catch((error) => {
  console.error(`[dev:verify-update] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
