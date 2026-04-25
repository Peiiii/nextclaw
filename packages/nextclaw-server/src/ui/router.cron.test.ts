import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-cron-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("cron routes", () => {
  it("creates cron jobs via POST /api/cron", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const createdJob = {
      id: "job-created",
      name: "job created",
      enabled: true,
      schedule: { kind: "every" as const, everyMs: 60_000 },
      payload: { message: "Ping", deliver: true, channel: "weixin", to: "chat-1" },
      state: { nextRunAtMs: 60_000, lastStatus: null, lastError: null },
      createdAtMs: 1,
      updatedAtMs: 2,
      deleteAfterRun: false
    };
    const cronService = {
      addJob: vi.fn(() => createdJob),
      listJobs: vi.fn(() => [])
    };

    const app = createUiRouter({
      configPath,
      cronService: cronService as never,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/cron", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "  job created  ",
        message: "  Ping  ",
        schedule: { kind: "every", everyMs: 60_000 },
        agentId: "main",
        sessionId: "session-existing",
        deliver: true,
        channel: "weixin",
        to: "chat-1",
        accountId: "acct-1"
      })
    });

    expect(response.status).toBe(201);
    const payload = await response.json() as {
      ok: true;
      data: {
        job: {
          id: string;
          name: string;
          enabled: boolean;
        };
      };
    };
    expect(payload.data.job).toMatchObject({
      id: "job-created",
      name: "job created",
      enabled: true
    });
    expect(cronService.addJob).toHaveBeenCalledWith({
      name: "job created",
      message: "Ping",
      schedule: { kind: "every", everyMs: 60_000 },
      agentId: "main",
      sessionId: "session-existing",
      deliver: true,
      channel: "weixin",
      to: "chat-1",
      accountId: "acct-1",
      deleteAfterRun: false
    });
  });

  it("lists disabled jobs by default and filters them when enabledOnly is set", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const jobs = [
      {
        id: "job-enabled",
        name: "enabled job",
        enabled: true,
        schedule: { kind: "every" as const, everyMs: 60_000 },
        payload: { message: "enabled" },
        state: {},
        createdAtMs: 1,
        updatedAtMs: 2,
        deleteAfterRun: false
      },
      {
        id: "job-disabled",
        name: "disabled job",
        enabled: false,
        schedule: { kind: "cron" as const, expr: "0 9 * * *", tz: "UTC" },
        payload: { message: "disabled" },
        state: {},
        createdAtMs: 3,
        updatedAtMs: 4,
        deleteAfterRun: false
      }
    ];
    const cronService = {
      listJobs: vi.fn((includeDisabled: boolean) => (includeDisabled ? jobs : jobs.filter((job) => job.enabled)))
    };

    const app = createUiRouter({
      configPath,
      cronService: cronService as never,
      publish: () => {}
    });

    const defaultResponse = await app.request("http://localhost/api/cron");
    expect(defaultResponse.status).toBe(200);
    const defaultPayload = await defaultResponse.json() as {
      ok: true;
      data: {
        total: number;
        jobs: Array<{ id: string; enabled: boolean }>;
      };
    };
    expect(defaultPayload.data.total).toBe(2);
    expect(defaultPayload.data.jobs).toMatchObject([
      { id: "job-enabled", enabled: true },
      { id: "job-disabled", enabled: false }
    ]);
    expect(cronService.listJobs).toHaveBeenNthCalledWith(1, true);

    const enabledOnlyResponse = await app.request("http://localhost/api/cron?enabledOnly=1");
    expect(enabledOnlyResponse.status).toBe(200);
    const enabledOnlyPayload = await enabledOnlyResponse.json() as {
      ok: true;
      data: {
        total: number;
        jobs: Array<{ id: string; enabled: boolean }>;
      };
    };
    expect(enabledOnlyPayload.data.total).toBe(1);
    expect(enabledOnlyPayload.data.jobs).toMatchObject([{ id: "job-enabled", enabled: true }]);
    expect(cronService.listJobs).toHaveBeenNthCalledWith(2, false);
  });
});
