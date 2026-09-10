import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import {
  serializeUnsignedUpdateManifest,
  type UpdateManifest,
  type UnsignedUpdateManifest,
} from "@nextclaw/kernel";

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

const listen = async (server: Server): Promise<number> => {
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("update fixture server did not bind");
  return address.port;
};

const createRuntimeArchive = async (launcherPath: string): Promise<Buffer> => {
  const zip = new JSZip();
  const platformKey = `${process.platform}-${process.arch}`;
  const runnerName = process.platform === "win32"
    ? "nextclaw-wasmtime-runner.exe"
    : "nextclaw-wasmtime-runner";
  const runnerPath = `runtime/resources/native/${platformKey}/${runnerName}`;
  zip.file("bundle/manifest.json", JSON.stringify({
    bundleVersion: "0.1.1",
    platform: process.platform,
    arch: process.arch,
    uiVersion: "0.1.1",
    runtimeVersion: "0.1.1",
    builtInPluginSetVersion: "0.1.1",
    launcherCompatibility: { minVersion: "0.1.0" },
    entrypoints: { runtimeScript: "runtime/dist/cli/app/index.js" },
    migrationVersion: 1,
  }));
  zip.file(
    "bundle/runtime/dist/cli/app/index.js",
    `const { spawnSync } = require("node:child_process");\nconst result = spawnSync(process.execPath, [${JSON.stringify(launcherPath)}, "runtime"], { stdio: "inherit", env: { ...process.env, NEXTCLAW_ACCEPTANCE_VERSION: "0.1.1" } });\nprocess.exit(result.status ?? 1);\n`,
  );
  zip.file(`bundle/${runnerPath}`, "runner", { unixPermissions: 0o755 });
  zip.file("bundle/ui/index.html", "<html></html>\n");
  zip.file("bundle/plugins/.keep", "\n");
  const archive = Buffer.from(await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" }));
  return archive;
};

const waitForOutput = async (
  outputPath: string,
  predicate: (events: Array<Record<string, unknown>>) => boolean,
): Promise<Array<Record<string, unknown>>> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const raw = await readFile(outputPath, "utf-8").catch(() => "");
    const events = raw.trim()
      ? raw.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      : [];
    if (predicate(events)) return events;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  const events = (await readFile(outputPath, "utf8")).trim().split("\n")
    .map((line) => { const { history: _history, sessions: _sessions, ...event } = JSON.parse(line); return event; });
  throw new Error(`timed out waiting for the replacement runtime: ${JSON.stringify(events)}`);
};

afterEach(async () => {
  for (const directory of temporaryDirectories) {
    const events = await readFile(join(directory, "events.ndjson"), "utf8").catch(() => "");
    for (const line of events.trim().split("\n").filter(Boolean)) {
      const event = JSON.parse(line) as { pid?: number };
      if (event.pid) {
        try { process.kill(event.pid, "SIGTERM"); } catch { /* Already exited. */ }
      }
    }
  }
  await Promise.all(servers.splice(0).map(
    async (server) => await new Promise<void>((resolvePromise) => server.close(() => resolvePromise())),
  ));
  await Promise.all(temporaryDirectories.splice(0).map(
    async (directory) => await rm(directory, { recursive: true, force: true }),
  ));
});

describe("planned restart self-update acceptance", () => {
  it("applies a signed local CLI update once, replaces the process, and recovers every active session once", async () => {
    const root = await mkdtemp(join(tmpdir(), "nextclaw-self-update-acceptance-"));
    temporaryDirectories.push(root);
    const outputPath = join(root, "events.ndjson");
    const publicKeyPath = join(root, "update-public.pem");
    const launcherPath = join(root, "launcher.cjs");
    const packagedRunner = join(root, "packaged-runner");
    await writeFile(outputPath, "", "utf-8");
    await writeFile(packagedRunner, "fixture");
    await chmod(packagedRunner, 0o755);
    const fixturePath = fileURLToPath(new URL(
      "./planned-restart-update-process-fixture.service.ts", import.meta.url,
    ));
    const tsxPath = createRequire(import.meta.url).resolve("tsx/cli");
    await writeFile(launcherPath,
      `const { spawnSync } = require("node:child_process");\nconst result = spawnSync(process.execPath, [${JSON.stringify(tsxPath)}, ${JSON.stringify(fixturePath)}, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });\nprocess.exit(result.status ?? 1);\n`,
    );
    const archive = await createRuntimeArchive(launcherPath);
    const keyPair = generateKeyPairSync("ed25519");
    await writeFile(
      publicKeyPath,
      keyPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
      "utf-8",
    );
    const unsignedManifest: UnsignedUpdateManifest = {
      channel: "stable",
      platform: process.platform,
      arch: process.arch,
      hostKind: "npm-runtime-bundle",
      latestVersion: "0.1.1",
      minimumLauncherVersion: "0.1.0",
      bundleUrl: "",
      bundleSha256: createHash("sha256").update(archive).digest("hex"),
      bundleSignature: sign(null, archive, keyPair.privateKey).toString("base64"),
      releaseNotesUrl: null,
    };
    const server = createServer(async (request, response) => {
      if (request.url === "/runtime.zip") {
        response.writeHead(200, { "content-length": archive.byteLength });
        response.end(archive);
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(manifest));
    });
    servers.push(server);
    const port = await listen(server);
    unsignedManifest.bundleUrl = `http://127.0.0.1:${port}/runtime.zip`;
    const manifest: UpdateManifest = {
      ...unsignedManifest,
      manifestSignature: sign(
        null,
        Buffer.from(serializeUnsignedUpdateManifest(unsignedManifest)),
        keyPair.privateKey,
      ).toString("base64"),
    };

    const oldProcess = spawn(process.execPath, [tsxPath, fixturePath, "runtime"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXTCLAW_HOME: root,
        TSX_TSCONFIG_PATH: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../tsconfig.json"),
        NEXTCLAW_RESTART_OPERATION_ID: "",
        NEXTCLAW_ACCEPTANCE_VERSION: "0.1.0",
        NEXTCLAW_UPDATE_MANIFEST_URL: `http://127.0.0.1:${port}/manifest.json`,
        NEXTCLAW_ACCEPTANCE_OUTPUT: outputPath,
        NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH: publicKeyPath,
        NEXTCLAW_ACCEPTANCE_LAUNCHER: launcherPath,
        NEXTCLAW_ACCEPTANCE_PACKAGED_RUNNER: packagedRunner,
        NEXTCLAW_DESKTOP_COMMAND_SURFACE: "0",
        NEXTCLAW_RUNTIME_BUNDLE_CHILD: "0",
        NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER: "0",
      },
    });
    let stderr = "";
    oldProcess.stdout.resume();
    oldProcess.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const oldExitCode = await new Promise<number | null>((resolvePromise) => {
      oldProcess.once("exit", resolvePromise);
    });
    expect(oldExitCode, stderr).toBe(0);

    const events = await waitForOutput(
      outputPath,
      (items) => items.some((event) => event.phase === "acceptance-complete"),
    );
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: "updated", output: expect.stringContaining('"targetVersion": "0.1.1"') }),
      expect.objectContaining({
        phase: "recovered",
        first: expect.objectContaining({ status: "recovered", resumed: 2, skipped: 0, failed: 0 }),
        second: expect.objectContaining({ status: "none" }),
      }),
      expect.objectContaining({ phase: "runtime-booted", version: "0.1.1" }),
    ]));
    expect(events.filter((event) => event.phase === "command" && event.command === "update")).toHaveLength(1);
    expect(events.filter((event) => event.phase === "command" && event.command === "restart")).toHaveLength(2);
    expect(events.filter((event) => event.phase === "recovered")).toHaveLength(2);
    const generations = events.filter((event) => event.phase === "process-generation");
    expect(generations.map((event) => event.generation)).toEqual([0, 1, 2]);
    expect(new Set(generations.map((event) => event.pid)).size).toBe(3);
    const inputs = events.filter((event) => event.phase === "model-input");
    expect(inputs.map((event) => event.sessionId).sort()).toEqual([
      "session-initiator", "session-initiator", "session-parallel", "session-parallel",
    ]);
    for (const input of inputs) {
      expect(JSON.stringify(input.history)).toContain(`saved-progress:${input.sessionId}`);
      expect(input.prompt).toContain("Do not repeat the update or restart command");
      expect(JSON.stringify(input.modelMessages)).toContain("planned NextClaw restart completed successfully");
      const messages = input.modelMessages as Array<{ role: string; tool_calls?: Array<{ id: string }>; tool_call_id?: string }>;
      const callIds = messages.flatMap((message) => message.tool_calls?.map((call) => call.id) ?? []);
      const resultIds = messages.filter((message) => message.role === "tool").map((message) => message.tool_call_id);
      expect(resultIds.sort()).toEqual(callIds.sort());
    }
  }, 45_000);
});
