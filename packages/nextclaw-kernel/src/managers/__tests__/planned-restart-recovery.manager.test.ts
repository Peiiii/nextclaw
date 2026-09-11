import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlannedRestartRecoveryManager } from "@kernel/managers/planned-restart-recovery.manager.js";

const temporaryDirectories: string[] = [];

async function createFixture(params: {
  activeRuns?: Array<{ sessionId: string; runId: string }>;
  continueRun?: (input: {
    operationId: string;
    sessionId: string;
    sourceRunId: string;
    triggeredAt: string;
  }) => Promise<boolean>;
  manifestTtlMs?: number;
  now?: () => Date;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-planned-restart-"));
  temporaryDirectories.push(directory);
  const order: string[] = [];
  const suspendAdmissions = vi.fn(async () => {
    order.push("suspend");
  });
  const resumeAdmissions = vi.fn(() => {
    order.push("resume");
  });
  const flushSessionEvents = vi.fn(async () => {
    order.push("flush");
  });
  const listActiveRuns = vi.fn(() => {
    order.push("snapshot");
    return params.activeRuns ?? [
      { sessionId: "session-a", runId: "run-a" },
      { sessionId: "session-b", runId: "run-b" },
    ];
  });
  const continueRun = vi.fn(params.continueRun ?? (async () => true));
  const manifestPath = join(directory, "planned-restart-recovery.json");
  const manager = new PlannedRestartRecoveryManager({
    manifestPath,
    listActiveRuns,
    flushSessionEvents,
    suspendAdmissions,
    resumeAdmissions,
    continueRun,
    manifestTtlMs: params.manifestTtlMs,
    now: params.now,
  });
  return {
    continueRun,
    flushSessionEvents,
    listActiveRuns,
    manager,
    manifestPath,
    order,
    resumeAdmissions,
    suspendAdmissions,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(
      async (directory) => await rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("PlannedRestartRecoveryManager", () => {
  it("suspends admissions, snapshots exact active runs, flushes events, and writes one manifest", async () => {
    const fixture = await createFixture();

    const [first, second] = await Promise.all([
      fixture.manager.prepare("cli.restart"), fixture.manager.prepare("duplicate request"),
    ]);

    expect(second).toEqual(first);
    expect(fixture.order).toEqual(["suspend", "snapshot", "flush"]);
    expect(fixture.suspendAdmissions).toHaveBeenCalledTimes(1);
    expect(fixture.listActiveRuns).toHaveBeenCalledTimes(1);
    const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf-8"));
    expect(manifest).toMatchObject({
      version: 1,
      operationId: first.operationId,
      reason: "cli.restart",
      runs: [
        { sessionId: "session-a", sourceRunId: "run-a" },
        { sessionId: "session-b", sourceRunId: "run-b" },
      ],
    });
  });

  it("does not consume a prepared manifest on ordinary startup without a restart token", async () => {
    const fixture = await createFixture();
    await fixture.manager.prepare("cli.restart");
    expect(await fixture.manager.recover(undefined)).toMatchObject({ status: "none", resumed: 0 });
    expect(existsSync(fixture.manifestPath)).toBe(true);
  });

  it("aborts only the matching prepared restart and reopens admissions", async () => {
    const fixture = await createFixture();
    const ticket = await fixture.manager.prepare("manual restart");

    await fixture.manager.abort("another-operation");
    expect(existsSync(fixture.manifestPath)).toBe(true);
    expect(fixture.resumeAdmissions).not.toHaveBeenCalled();

    await fixture.manager.abort(ticket.operationId);
    expect(existsSync(fixture.manifestPath)).toBe(false);
    expect(fixture.resumeAdmissions).toHaveBeenCalledTimes(1);
  });

  it("uses a separate successor instance to claim once and isolate per-session outcomes", async () => {
    const oldRuntime = await createFixture();
    const ticket = await oldRuntime.manager.prepare("AI requested restart");
    const continued: string[] = [];
    const successor = new PlannedRestartRecoveryManager({
      manifestPath: oldRuntime.manifestPath,
      listActiveRuns: () => [],
      flushSessionEvents: async () => undefined,
      suspendAdmissions: async () => undefined,
      resumeAdmissions: () => undefined,
      continueRun: async ({ sessionId, sourceRunId }) => {
        continued.push(`${sessionId}:${sourceRunId}`);
        if (sessionId === "session-b") return false;
        return true;
      },
    });

    const recovered = await successor.recover(ticket.operationId);
    const repeated = await successor.recover(ticket.operationId);

    expect(recovered).toMatchObject({
      status: "recovered",
      operationId: ticket.operationId,
      resumed: 1,
      skipped: 1,
      failed: 0,
    });
    expect(repeated.status).toBe("none");
    expect(continued).toEqual(["session-a:run-a", "session-b:run-b"]);
    expect(existsSync(oldRuntime.manifestPath)).toBe(false);
  });

  it("lets a supervisor successor claim the prepared manifest without an inherited token", async () => {
    const oldRuntime = await createFixture({
      activeRuns: [{ sessionId: "session-a", runId: "run-a" }],
    });
    const ticket = await oldRuntime.manager.prepare("systemd restart");
    const successor = new PlannedRestartRecoveryManager({
      manifestPath: oldRuntime.manifestPath,
      listActiveRuns: () => [],
      flushSessionEvents: async () => undefined,
      suspendAdmissions: async () => undefined,
      resumeAdmissions: () => undefined,
      continueRun: async () => true,
    });

    await expect(successor.recoverFromSupervisor()).resolves.toMatchObject({
      status: "recovered",
      operationId: ticket.operationId,
      resumed: 1,
    });
    await expect(successor.recoverFromSupervisor()).resolves.toMatchObject({
      status: "none",
      resumed: 0,
    });
  });

  it("does not recover a supervisor startup without a prepared manifest", async () => {
    const fixture = await createFixture();

    await expect(fixture.manager.recoverFromSupervisor()).resolves.toMatchObject({
      status: "none",
      resumed: 0,
    });
    expect(fixture.continueRun).not.toHaveBeenCalled();
  });

  it("continues remaining sessions when one recovery callback fails", async () => {
    const oldRuntime = await createFixture({
      activeRuns: [
        { sessionId: "session-a", runId: "run-a" },
        { sessionId: "session-b", runId: "run-b" },
        { sessionId: "session-c", runId: "run-c" },
      ],
    });
    const ticket = await oldRuntime.manager.prepare("AI requested restart");
    const continued: string[] = [];
    const successor = new PlannedRestartRecoveryManager({
      manifestPath: oldRuntime.manifestPath,
      listActiveRuns: () => [],
      flushSessionEvents: async () => undefined,
      suspendAdmissions: async () => undefined,
      resumeAdmissions: () => undefined,
      continueRun: async ({ sessionId }) => {
        continued.push(sessionId);
        if (sessionId === "session-b") throw new Error("continuation unavailable");
        return true;
      },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const recovered = await successor.recover(ticket.operationId);

    expect(recovered).toMatchObject({ resumed: 2, skipped: 0, failed: 1 });
    expect(continued).toEqual(["session-a", "session-b", "session-c"]);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("keeps a manifest for the matching successor when another operation id starts", async () => {
    const fixture = await createFixture();
    const ticket = await fixture.manager.prepare("manual restart");

    const mismatch = await fixture.manager.recover("wrong-operation");

    expect(mismatch.status).toBe("mismatch");
    expect(existsSync(fixture.manifestPath)).toBe(true);
    expect((await fixture.manager.recover(ticket.operationId)).status).toBe("recovered");
  });

  it("deletes an expired manifest without continuing any session", async () => {
    let now = new Date("2026-09-10T10:00:00.000Z");
    const fixture = await createFixture({
      manifestTtlMs: 1_000,
      now: () => now,
    });
    const ticket = await fixture.manager.prepare("manual restart");
    now = new Date("2026-09-10T10:00:02.000Z");

    const result = await fixture.manager.recover(ticket.operationId);

    expect(result.status).toBe("expired");
    expect(fixture.continueRun).not.toHaveBeenCalled();
    expect(existsSync(fixture.manifestPath)).toBe(false);
  });

  it("removes invalid input at the persistence boundary", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.manifestPath, "{not-json", "utf-8");

    const result = await fixture.manager.recover("operation-a");

    expect(result.status).toBe("invalid");
    expect(existsSync(fixture.manifestPath)).toBe(false);
  });

  it("reopens admissions when durable preparation fails", async () => {
    const fixture = await createFixture();
    fixture.flushSessionEvents.mockRejectedValueOnce(new Error("journal unavailable"));

    await expect(fixture.manager.prepare("manual restart")).rejects.toThrow(
      "journal unavailable",
    );

    expect(fixture.resumeAdmissions).toHaveBeenCalledTimes(1);
    expect(existsSync(fixture.manifestPath)).toBe(false);
  });
});

describe("PlannedRestartRecoveryManager cross-process recovery", () => {
  it("passes supervisor recovery through the manifest across two processes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-planned-restart-process-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "events.ndjson");
    await writeFile(outputPath, "", "utf-8");
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const managerModuleUrl = pathToFileURL(resolve(
      packageRoot,
      "src/managers/planned-restart-recovery.manager.ts",
    )).href;
    const tsxPath = createRequire(import.meta.url).resolve("tsx/cli");
    const script = `
      import { appendFile } from "node:fs/promises";
      import { join } from "node:path";
      import { PlannedRestartRecoveryManager } from ${JSON.stringify(managerModuleUrl)};
      const home = process.env.NEXTCLAW_HOME;
      const outputPath = process.env.NEXTCLAW_ACCEPTANCE_OUTPUT;
      const cycle = process.env.NEXTCLAW_ACCEPTANCE_CYCLE;
      if (!home || !outputPath) throw new Error("missing acceptance environment");
      const continued = [];
      const manager = new PlannedRestartRecoveryManager({
        manifestPath: join(home, "planned-restart-recovery.json"),
        listActiveRuns: () => [
          { sessionId: "session-initiator", runId: "run-initiator" },
          { sessionId: "session-parallel", runId: "run-parallel" },
        ],
        flushSessionEvents: async () => undefined,
        suspendAdmissions: async () => undefined,
        resumeAdmissions: () => undefined,
        continueRun: async (input) => (continued.push(input), true),
      });
      const record = async (event) => await appendFile(
        outputPath,
        JSON.stringify({ pid: process.pid, cycle, ...event }) + "\\n",
        "utf-8",
      );
      if (process.env.NEXTCLAW_ACCEPTANCE_MODE === "prepare") {
        await record({ phase: "prepared", ticket: await manager.prepare("systemd restart") });
        process.exit(75);
      } else {
        const first = await manager.recoverFromSupervisor();
        const second = await manager.recoverFromSupervisor();
        await record({ phase: "recovered", first, second, continued });
      }
    `;
    const fixturePath = join(directory, "supervisor-fixture.mts");
    await writeFile(fixturePath, script, "utf-8");
    const run = (mode: "prepare" | "recover", cycle: string) => spawnSync(
      process.execPath,
      [tsxPath, fixturePath],
      {
        cwd: packageRoot,
        encoding: "utf-8",
        env: {
          ...process.env,
          NEXTCLAW_HOME: directory,
          NEXTCLAW_ACCEPTANCE_OUTPUT: outputPath,
          NEXTCLAW_ACCEPTANCE_MODE: mode,
          NEXTCLAW_ACCEPTANCE_CYCLE: cycle,
          NEXTCLAW_PROCESS_SUPERVISOR: "systemd",
          NEXTCLAW_RESTART_OPERATION_ID: "",
        },
      },
    );

    for (const cycle of ["first", "second"]) {
      const oldProcess = run("prepare", cycle);
      expect(oldProcess.status, oldProcess.stderr).toBe(75);
      const successor = run("recover", cycle);
      expect(successor.status, successor.stderr).toBe(0);
    }

    const events = (await readFile(outputPath, "utf-8")).trim().split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(new Set(events.map((event) => event.pid)).size).toBe(4);
    expect(events.filter((event) => event.phase === "prepared")).toHaveLength(2);
    const recoveredEvents = events.filter((event) => event.phase === "recovered");
    expect(recoveredEvents).toHaveLength(2);
    for (const event of recoveredEvents) {
      expect(event).toEqual(expect.objectContaining({
        first: expect.objectContaining({ status: "recovered", resumed: 2 }),
        second: expect.objectContaining({ status: "none", resumed: 0 }),
        continued: expect.arrayContaining([
          expect.objectContaining({ sessionId: "session-initiator", sourceRunId: "run-initiator" }),
          expect.objectContaining({ sessionId: "session-parallel", sourceRunId: "run-parallel" }),
        ]),
      }));
    }
  });

});
