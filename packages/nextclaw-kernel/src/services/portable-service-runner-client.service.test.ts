import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PortableServiceRunnerClientService } from "./portable-service-runner-client.service.js";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createFakeRunner(protocolVersion: string): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-runner-"));
  tempDirectories.push(directory);
  const runnerPath = join(directory, "fake-runner.mjs");
  writeFileSync(runnerPath, `#!/usr/bin/env node
import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  process.stdout.write(JSON.stringify({
    requestId: request.requestId,
    protocolVersion: ${JSON.stringify(protocolVersion)},
    ok: true,
    result: { runnerPid: process.pid, loadedComponents: 0, providerInstances: 0, residentInstances: 0 }
  }) + "\\n");
});
`);
  chmodSync(runnerPath, 0o755);
  return runnerPath;
}

describe("PortableServiceRunnerClientService distribution contract", () => {
  it("fails clearly when the distribution has no runner", async () => {
    const client = new PortableServiceRunnerClientService({ env: {} });

    await expect(client.stats()).rejects.toMatchObject({
      code: "PORTABLE_RUNNER_UNAVAILABLE",
    });
  });

  it("does not fall back when an explicit development override is invalid", async () => {
    const client = new PortableServiceRunnerClientService({
      env: { NEXTCLAW_WASMTIME_RUNNER_PATH: "/missing/explicit-runner" },
      runnerPath: createFakeRunner("0.1.0"),
    });

    await expect(client.stats()).rejects.toThrow("/missing/explicit-runner");
  });

  it("rejects an incompatible runner protocol on the first response", async () => {
    const client = new PortableServiceRunnerClientService({
      env: {},
      runnerPath: createFakeRunner("9.9.9"),
    });

    await expect(client.stats()).rejects.toMatchObject({
      code: "PORTABLE_RUNNER_PROTOCOL_MISMATCH",
    });
    await client.dispose();
  });

  it("uses the distribution runner when no development override exists", async () => {
    const client = new PortableServiceRunnerClientService({
      env: {},
      runnerPath: createFakeRunner("0.1.0"),
    });

    await expect(client.stats()).resolves.toMatchObject({ loadedComponents: 0 });
    await client.dispose();
  });
});
