import { describe, expect, it, vi } from "vitest";
import { CronTool } from "./cron.js";

describe("CronTool", () => {
  it("documents that relative times must be based on checked current time", () => {
    const tool = new CronTool({} as never);

    expect(tool.description).toContain("For relative times like 'in 5 minutes'");
    expect(tool.description).toContain("do not guess");
    expect(
      ((tool.parameters.properties as Record<string, { description?: string }>).at?.description ?? ""),
    ).toContain("If the user gave a relative time");
  });

  it("adds a job with legacy flat params when action is omitted", async () => {
    const cronService = {
      addJob: vi.fn().mockReturnValue({ id: "job-1", name: "reminder" })
    };
    const tool = new CronTool(cronService as never);

    const result = JSON.parse(
      await tool.execute({
        name: "reminder",
        message: "take a break",
        every: 60
      })
    ) as { action: string; job: { id: string; name: string } };

    expect(result).toEqual({
      action: "add",
      job: { id: "job-1", name: "reminder" }
    });
    expect(cronService.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "reminder",
        message: "take a break",
        schedule: { kind: "every", everyMs: 60_000 }
      })
    );
  });

  it("supports skill aliases for add", async () => {
    const cronService = {
      addJob: vi.fn().mockReturnValue({ id: "job-2", name: "report" })
    };
    const tool = new CronTool(cronService as never);

    await tool.execute({
      action: "add",
      name: "report",
      message: "daily report",
      every_seconds: 120
    });

    expect(cronService.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: { kind: "every", everyMs: 120_000 }
      })
    );
  });

  it("supports one-time jobs via at", async () => {
    const cronService = {
      addJob: vi.fn().mockReturnValue({ id: "job-at", name: "one-shot" })
    };
    const tool = new CronTool(cronService as never);

    await tool.execute({
      action: "add",
      name: "one-shot",
      message: "At the scheduled time, send a WeChat message saying: Meeting starts in 5 minutes.",
      at: "2026-03-31T18:05:00+08:00"
    });

    expect(cronService.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: { kind: "at", atMs: Date.parse("2026-03-31T18:05:00+08:00") }
      })
    );
  });

  it("passes agent ownership through when adding a job", async () => {
    const cronService = {
      addJob: vi.fn().mockReturnValue({ id: "job-agent", name: "review" })
    };
    const tool = new CronTool(cronService as never);

    await tool.execute({
      action: "add",
      name: "review",
      message: "review the release notes",
      every: 300,
      agentId: "engineer"
    });

    expect(cronService.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "engineer",
      })
    );
  });

  it("lists jobs when action is list", async () => {
    const cronService = {
      listJobs: vi.fn().mockReturnValue([{ id: "job-1", name: "reminder" }])
    };
    const tool = new CronTool(cronService as never);

    const result = JSON.parse(
      await tool.execute({
        action: "list",
        includeDisabled: true
      })
    ) as { jobs: Array<{ id: string; name: string }> };

    expect(result.jobs).toEqual([{ id: "job-1", name: "reminder" }]);
    expect(cronService.listJobs).toHaveBeenCalledWith(true);
  });

  it("can list only enabled jobs when explicitly requested", async () => {
    const cronService = {
      listJobs: vi.fn().mockReturnValue([{ id: "job-1", name: "reminder" }])
    };
    const tool = new CronTool(cronService as never);

    await tool.execute({
      action: "list",
      enabledOnly: true
    });

    expect(cronService.listJobs).toHaveBeenCalledWith(false);
  });

  it("removes jobs via job_id alias", async () => {
    const cronService = {
      removeJob: vi.fn().mockReturnValue(true)
    };
    const tool = new CronTool(cronService as never);

    const result = JSON.parse(
      await tool.execute({
        action: "remove",
        job_id: "job-3"
      })
    ) as { removed: boolean; jobId: string };

    expect(result).toEqual({ removed: true, jobId: "job-3" });
    expect(cronService.removeJob).toHaveBeenCalledWith("job-3");
  });

  it("rejects remove without a job id", async () => {
    const cronService = {
      removeJob: vi.fn()
    };
    const tool = new CronTool(cronService as never);

    const result = await tool.execute({
      action: "remove"
    });

    expect(result).toBe("Error: jobId is required for remove");
    expect(cronService.removeJob).not.toHaveBeenCalled();
  });

  it("disables jobs without deleting them", async () => {
    const cronService = {
      enableJob: vi.fn().mockReturnValue({ id: "job-4", name: "report", enabled: false })
    };
    const tool = new CronTool(cronService as never);

    const result = JSON.parse(
      await tool.execute({
        action: "disable",
        jobId: "job-4"
      })
    ) as { action: string; updated: boolean; job: { id: string; name: string; enabled: boolean } };

    expect(result).toEqual({
      action: "disable",
      updated: true,
      job: { id: "job-4", name: "report", enabled: false }
    });
    expect(cronService.enableJob).toHaveBeenCalledWith("job-4", false);
  });

  it("enables jobs explicitly", async () => {
    const cronService = {
      enableJob: vi.fn().mockReturnValue({ id: "job-5", name: "report", enabled: true })
    };
    const tool = new CronTool(cronService as never);

    const result = JSON.parse(
      await tool.execute({
        action: "enable",
        job_id: "job-5"
      })
    ) as { action: string; updated: boolean; job: { id: string; name: string; enabled: boolean } };

    expect(result).toEqual({
      action: "enable",
      updated: true,
      job: { id: "job-5", name: "report", enabled: true }
    });
    expect(cronService.enableJob).toHaveBeenCalledWith("job-5", true);
  });
});
