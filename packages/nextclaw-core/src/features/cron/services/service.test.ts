import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";
import type { CronStore } from "./types.js";

function createStorePath(rootDir: string): string {
  return join(rootDir, "cron", "jobs.json");
}

function writeStore(storePath: string, store: CronStore): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function readStore(storePath: string): CronStore {
  return JSON.parse(readFileSync(storePath, "utf-8")) as CronStore;
}

describe("CronService", () => {
  let tempDir: string;
  let storePath: string;

  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-cron-service-"));
    storePath = createStorePath(tempDir);
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores the target session id on created jobs", () => {
    vi.setSystemTime(Date.parse("2026-04-08T02:00:00.000Z"));
    const service = new CronService(storePath);

    const job = service.addJob({
      name: "continue-session",
      schedule: { kind: "every", everyMs: 60_000 },
      message: "continue the existing thread",
      sessionId: "session-existing",
    });

    expect(job.payload.sessionId).toBe("session-existing");
    expect(readStore(storePath).jobs[0]?.payload.sessionId).toBe("session-existing");
  });

  it("preserves every-job cadence across service start without replaying missed runs", async () => {
    const firstScheduledRunAtMs = Date.parse("2026-04-08T02:10:00.000Z");
    const everyMs = 120_000;
    writeStore(storePath, {
      version: 1,
      jobs: [
        {
          id: "job-1",
          name: "two-minute-joke",
          enabled: true,
          schedule: { kind: "every", everyMs },
          payload: { message: "tell a joke" },
          state: {
            nextRunAtMs: firstScheduledRunAtMs,
            lastRunAtMs: firstScheduledRunAtMs - everyMs
          },
          createdAtMs: firstScheduledRunAtMs - everyMs,
          updatedAtMs: firstScheduledRunAtMs - everyMs,
          deleteAfterRun: false
        }
      ]
    });
    vi.setSystemTime(firstScheduledRunAtMs + 5 * everyMs + 15_000);

    const service = new CronService(storePath);
    await service.start();
    service.stop();

    const [job] = readStore(storePath).jobs;
    expect(job.state.lastRunAtMs).toBe(firstScheduledRunAtMs - everyMs);
    expect(job.state.nextRunAtMs).toBe(firstScheduledRunAtMs + 6 * everyMs);
  });

  it("keeps every-job cadence aligned after a late execution", async () => {
    const firstScheduledRunAtMs = Date.parse("2026-04-08T02:10:00.000Z");
    const everyMs = 120_000;
    writeStore(storePath, {
      version: 1,
      jobs: [
        {
          id: "job-2",
          name: "aligned-interval",
          enabled: true,
          schedule: { kind: "every", everyMs },
          payload: { message: "keep cadence" },
          state: {
            nextRunAtMs: firstScheduledRunAtMs
          },
          createdAtMs: firstScheduledRunAtMs - everyMs,
          updatedAtMs: firstScheduledRunAtMs - everyMs,
          deleteAfterRun: false
        }
      ]
    });
    vi.setSystemTime(firstScheduledRunAtMs + 30_000);

    const onJob = vi.fn().mockResolvedValue("ok");
    const service = new CronService(storePath, onJob);

    await service.runJob("job-2");

    const [job] = readStore(storePath).jobs;
    expect(onJob).toHaveBeenCalledTimes(1);
    expect(job.state.lastRunAtMs).toBe(firstScheduledRunAtMs + 30_000);
    expect(job.state.nextRunAtMs).toBe(firstScheduledRunAtMs + everyMs);
  });

  it("executes past-due cron jobs after reload instead of silently advancing them", async () => {
    writeStore(storePath, {
      version: 1,
      jobs: []
    });
    vi.setSystemTime(Date.parse("2026-04-08T12:00:25.000Z"));

    const onJob = vi.fn().mockResolvedValue("ok");
    const service = new CronService(storePath, onJob);
    await service.start();

    writeStore(storePath, {
      version: 1,
      jobs: [
        {
          id: "job-3",
          name: "two-minute-cron",
          enabled: true,
          schedule: { kind: "cron", expr: "*/2 * * * *" },
          payload: { message: "tell a joke" },
          state: {
            nextRunAtMs: Date.parse("2026-04-08T12:00:00.000Z")
          },
          createdAtMs: Date.parse("2026-04-08T11:58:00.000Z"),
          updatedAtMs: Date.parse("2026-04-08T11:58:00.000Z"),
          deleteAfterRun: false
        }
      ]
    });

    service.reloadFromStore();
    await vi.advanceTimersByTimeAsync(0);
    service.stop();

    const [job] = readStore(storePath).jobs;
    expect(onJob).toHaveBeenCalledTimes(1);
    expect(job.state.lastRunAtMs).toBe(Date.parse("2026-04-08T12:00:25.000Z"));
    expect(job.state.nextRunAtMs).toBe(Date.parse("2026-04-08T12:02:00.000Z"));
  });

  it("does not rewrite the cron store on reload when nothing changed", async () => {
    vi.useRealTimers();
    writeStore(storePath, {
      version: 1,
      jobs: [
        {
          id: "job-4",
          name: "stable-store",
          enabled: true,
          schedule: { kind: "every", everyMs: 120_000 },
          payload: { message: "keep still" },
          state: {
            nextRunAtMs: Date.parse("2026-04-08T12:10:00.000Z")
          },
          createdAtMs: Date.parse("2026-04-08T12:08:00.000Z"),
          updatedAtMs: Date.parse("2026-04-08T12:08:00.000Z"),
          deleteAfterRun: false
        }
      ]
    });

    const beforeReloadMtimeMs = statSync(storePath).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const service = new CronService(storePath);
    service.reloadFromStore();

    expect(statSync(storePath).mtimeMs).toBe(beforeReloadMtimeMs);
  });

  it("logs unexpected timer failures and keeps the scheduler alive", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onJob = vi.fn().mockResolvedValue("ok");
    const service = new CronService(storePath, onJob);

    await service.start();
    service.addJob({
      name: "guard-background-failure",
      schedule: { kind: "every", everyMs: 1_000 },
      message: "still run"
    });

    const serviceInternal = service as unknown as {
      saveStore: () => void;
    };
    const originalSaveStore = serviceInternal.saveStore.bind(service);
    const saveStoreSpy = vi
      .fn<() => void>()
      .mockImplementationOnce(() => {
        throw new Error("persist boom");
      })
      .mockImplementation(() => {
        originalSaveStore();
      });
    serviceInternal.saveStore = saveStoreSpy;

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onJob).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[cron] background timer failed:"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("persist boom"));

    await vi.advanceTimersByTimeAsync(1_000);
    service.stop();

    expect(onJob).toHaveBeenCalledTimes(2);
  });
});
