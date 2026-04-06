import type * as NextclawCore from "@nextclaw/core";
import type { Context } from "hono";
import type { CronActionResult, CronEnableRequest, CronJobView, CronRunRequest } from "../types.js";
import { err, ok, readJson } from "./response.js";
import type { CronJobEntry, UiRouterOptions } from "./types.js";

function toIsoTime(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function buildCronJobView(job: CronJobEntry): CronJobView {
  return {
    id: job.id,
    name: job.name,
    enabled: job.enabled,
    schedule: job.schedule,
    payload: job.payload,
    state: {
      nextRunAt: toIsoTime(job.state.nextRunAtMs),
      lastRunAt: toIsoTime(job.state.lastRunAtMs),
      lastStatus: job.state.lastStatus ?? null,
      lastError: job.state.lastError ?? null
    },
    createdAt: new Date(job.createdAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
    deleteAfterRun: job.deleteAfterRun
  };
}

function findCronJob(service: InstanceType<typeof NextclawCore.CronService>, id: string): CronJobEntry | null {
  const jobs = service.listJobs(true) as CronJobEntry[];
  return jobs.find((job) => job.id === id) ?? null;
}

export class CronRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly listJobs = (c: Context) => {
    if (!this.options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const query = c.req.query();
    const enabledOnly =
      query.enabledOnly === "1" ||
      query.enabledOnly === "true" ||
      query.enabledOnly === "yes" ||
      query.all === "0" ||
      query.all === "false" ||
      query.all === "no";
    const includeDisabled = !enabledOnly;
    const jobs = this.options.cronService.listJobs(includeDisabled).map((job) => buildCronJobView(job as CronJobEntry));
    return c.json(ok({ jobs, total: jobs.length }));
  };

  readonly deleteJob = (c: Context) => {
    if (!this.options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const deleted = this.options.cronService.removeJob(id);
    if (!deleted) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    return c.json(ok({ deleted: true }));
  };

  readonly enableJob = async (c: Context) => {
    if (!this.options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const body = await readJson<CronEnableRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (typeof body.data.enabled !== "boolean") {
      return c.json(err("INVALID_BODY", "enabled must be boolean"), 400);
    }
    const job = this.options.cronService.enableJob(id, body.data.enabled);
    if (!job) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    const data: CronActionResult = { job: buildCronJobView(job as CronJobEntry) };
    return c.json(ok(data));
  };

  readonly runJob = async (c: Context) => {
    if (!this.options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const body = await readJson<CronRunRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const existing = findCronJob(this.options.cronService, id);
    if (!existing) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    const executed = await this.options.cronService.runJob(id, Boolean(body.data.force));
    const after = findCronJob(this.options.cronService, id);
    const data: CronActionResult = {
      job: after ? buildCronJobView(after) : null,
      executed
    };
    return c.json(ok(data));
  };
}
