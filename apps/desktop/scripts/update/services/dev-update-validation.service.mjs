#!/usr/bin/env node
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  incrementPatchVersion,
  prepareLocalUpdateChannelArtifacts,
  readBundleVersion
} from "./local-update-channel-artifacts.service.mjs";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const localRuntimeScript = resolve(workspaceRoot, "packages", "nextclaw", "dist", "cli", "app", "index.js");
const existingBuildSeedBundlePath = resolve(desktopDir, "build", "update", "seed-product-bundle.zip");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function shouldUseShell(command) {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

function assertFile(filePath, label) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

class DesktopDevUpdateValidationRunner {
  constructor(args) {
    this.args = args;
    this.tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-dev-update-validation-"));
    this.serverRoot = join(this.tempRoot, "server-root");
    this.runtimeHome = join(this.tempRoot, "runtime-home");
    this.desktopData = join(this.tempRoot, "desktop-data");
    this.keep = args.keep === "true" || args["prepare-only"] === "true";
    this.prepareOnly = args["prepare-only"] === "true";
    this.skipBuild = args["skip-build"] === "true";
    this.host = args.host?.trim() || "127.0.0.1";
    this.requestedPort = Number.parseInt(args.port?.trim() || "43010", 10);
    if (!Number.isInteger(this.requestedPort) || this.requestedPort <= 0) {
      throw new Error(`Invalid --port value: ${args.port ?? "43010"}`);
    }
    this.httpServer = null;
    this.electronProcess = null;
    this.generatedStableSeedBundle = false;
  }

  run = async () => {
    await this.prepareDirectories();
    const seedBundlePath = await this.resolveStableSeedBundlePath();
    const stableVersion = await readBundleVersion(seedBundlePath);
    const betaVersion = this.args["beta-version"]?.trim() || incrementPatchVersion(stableVersion);
    const port = this.requestedPort;
    const manifestBaseUrl = `http://${this.host}:${String(port)}/desktop-updates`;
    const keyPair = generateKeyPairSync("ed25519");
    const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();

    await this.prepareUpdateArtifacts({
      seedBundlePath,
      stableVersion,
      betaVersion,
      manifestBaseUrl,
      privateKey: keyPair.privateKey
    });

    if (this.prepareOnly) {
      this.printPrepareOnlyResult({ seedBundlePath, stableVersion, betaVersion, manifestBaseUrl });
      return;
    }

    if (!this.skipBuild) {
      await this.buildLocalArtifacts();
    }
    assertFile(localRuntimeScript, "Local runtime script");

    await this.startLocalUpdateServer(port);
    this.printManualInstructions({ stableVersion, betaVersion, manifestBaseUrl });
    this.launchElectron({ manifestBaseUrl, publicKeyPem });
    await this.waitUntilInterrupted();
  };

  cleanup = async () => {
    if (this.httpServer) {
      await new Promise((resolveClose) => this.httpServer.close(() => resolveClose()));
      this.httpServer = null;
    }
    if (this.electronProcess && !this.electronProcess.killed) {
      try {
        this.electronProcess.kill("SIGTERM");
      } catch {
        // The child may already have exited during cleanup.
      }
    }
    if (this.keep) {
      console.log(`[desktop-dev-update] kept validation root: ${this.tempRoot}`);
      return;
    }
    rmSync(this.tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };

  prepareDirectories = async () => {
    await mkdir(this.serverRoot, { recursive: true });
    await mkdir(this.runtimeHome, { recursive: true });
    await mkdir(this.desktopData, { recursive: true });
  };

  resolveStableSeedBundlePath = async () => {
    const explicitSeedBundlePath = this.args["stable-seed-bundle"]?.trim();
    if (explicitSeedBundlePath) {
      const resolvedSeedBundlePath = resolve(explicitSeedBundlePath);
      assertFile(resolvedSeedBundlePath, "Stable seed bundle");
      return resolvedSeedBundlePath;
    }

    if (this.skipBuild && existsSync(existingBuildSeedBundlePath)) {
      return existingBuildSeedBundlePath;
    }

    if (this.skipBuild) {
      throw new Error(
        `--skip-build requires --stable-seed-bundle or an existing seed bundle at ${existingBuildSeedBundlePath}`
      );
    }

    const seedOutputDir = join(this.tempRoot, "seed");
    this.generatedStableSeedBundle = true;
    await this.runCommand(pnpmCommand, [
      "-C",
      "apps/desktop",
      "bundle:seed",
      "--",
      "--channel",
      "stable",
      "--output-dir",
      seedOutputDir
    ]);
    const seedBundlePath = join(seedOutputDir, "seed-product-bundle.zip");
    assertFile(seedBundlePath, "Generated stable seed bundle");
    return seedBundlePath;
  };

  prepareUpdateArtifacts = async ({ seedBundlePath, stableVersion, betaVersion, manifestBaseUrl, privateKey }) => {
    const stableRoot = join(this.serverRoot, "desktop-updates", "stable");
    const betaRoot = join(this.serverRoot, "desktop-updates", "beta");
    await mkdir(stableRoot, { recursive: true });
    await mkdir(betaRoot, { recursive: true });
    await prepareLocalUpdateChannelArtifacts({
      stableSeedBundlePath: seedBundlePath,
      stableVersion,
      betaVersion,
      stableRoot,
      betaRoot,
      manifestBaseUrl,
      privateKey
    });
  };

  buildLocalArtifacts = async () => {
    if (!this.generatedStableSeedBundle) {
      await this.runCommand(pnpmCommand, ["-C", "packages/nextclaw-ui", "build"]);
      await this.runCommand(pnpmCommand, ["-C", "packages/nextclaw", "build"]);
    }
    await this.runCommand(pnpmCommand, ["-C", "apps/desktop", "build:main"]);
  };

  startLocalUpdateServer = async (port) => {
    this.httpServer = createHttpServer((request, response) => {
      const requestPath = request.url ? request.url.split("?")[0] : "/";
      const filePath = resolve(this.serverRoot, `.${requestPath}`);
      if (!filePath.startsWith(resolve(this.serverRoot))) {
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
      this.httpServer.once("error", rejectListen);
      this.httpServer.listen(port, this.host, resolveListen);
    });
  };

  launchElectron = ({ manifestBaseUrl, publicKeyPem }) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    this.electronProcess = spawn(pnpmCommand, ["-C", "apps/desktop", "exec", "electron", "."], {
      cwd: workspaceRoot,
      env: {
        ...env,
        NEXTCLAW_HOME: this.runtimeHome,
        NEXTCLAW_DESKTOP_DATA_DIR: this.desktopData,
        NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL: manifestBaseUrl,
        NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY: publicKeyPem,
        NEXTCLAW_DESKTOP_RUNTIME_SCRIPT: localRuntimeScript
      },
      stdio: "inherit",
      shell: shouldUseShell(pnpmCommand)
    });
    this.electronProcess.once("exit", (code) => {
      console.log(
        `[desktop-dev-update] Electron process exited with ${String(code)}. The local update server is still running; press Ctrl+C when validation is done.`
      );
    });
  };

  waitUntilInterrupted = async () => {
    await new Promise((resolveStop) => {
      process.once("SIGINT", resolveStop);
      process.once("SIGTERM", resolveStop);
    });
  };

  runCommand = (command, args) => {
    console.log(`[desktop-dev-update] ${command} ${args.join(" ")}`);
    return new Promise((resolveRun, rejectRun) => {
      const child = spawn(command, args, {
        cwd: workspaceRoot,
        env: process.env,
        stdio: "inherit",
        shell: shouldUseShell(command)
      });
      child.once("error", rejectRun);
      child.once("exit", (code) => {
        if (code === 0) {
          resolveRun();
          return;
        }
        rejectRun(new Error(`${command} ${args.join(" ")} failed with exit code ${String(code ?? 1)}`));
      });
    });
  };

  printPrepareOnlyResult = ({ seedBundlePath, stableVersion, betaVersion, manifestBaseUrl }) => {
    console.log(
      JSON.stringify(
        {
          seedBundlePath,
          serverRoot: this.serverRoot,
          desktopData: this.desktopData,
          runtimeHome: this.runtimeHome,
          stableVersion,
          betaVersion,
          manifestBaseUrl
        },
        null,
        2
      )
    );
  };

  printManualInstructions = ({ stableVersion, betaVersion, manifestBaseUrl }) => {
    console.log(`
[desktop-dev-update] Local update server: ${manifestBaseUrl}
[desktop-dev-update] Runtime data is isolated:
  NEXTCLAW_HOME=${this.runtimeHome}
  NEXTCLAW_DESKTOP_DATA_DIR=${this.desktopData}

Manual validation:
1. Wait for the desktop window to open.
2. The first boot should stage stable bundle ${stableVersion} in the isolated launcher data dir.
3. In the app, open Settings > Desktop Updates.
4. Stable should be up to date. Switch to Beta and check for updates.
5. Download beta ${betaVersion}; the product version area should show download progress next to the version.
6. After download, the same version area should show an Update button.
7. Click Update. The app restarts and the launcher state/current pointer should move to ${betaVersion}.
8. Close the app and press Ctrl+C here when validation is done.
`);
  };
}

const runner = new DesktopDevUpdateValidationRunner(parseArgs(process.argv.slice(2)));
try {
  await runner.run();
} catch (error) {
  console.error(`[desktop-dev-update] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await runner.cleanup();
}
