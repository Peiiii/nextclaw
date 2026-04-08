import type * as NextclawCore from "@nextclaw/core";
import type { Context } from "hono";
import type {
  CronActionResult,
  CronCreateRequest,
  CronCreateResult,
  CronEnableRequest,
  CronJobView,
  CronRunRequest
} from "../types.js";
import { err, ok, readJson, readNonEmptyString } from "./response.js";
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

type CronCreateParams = Parameters<InstanceType<typeof NextclawCore.CronService>["addJob"]>[0];

function normalizeCronSchedule(schedule: CronCreateRequest["schedule"] | undefined): CronJobEntry["schedule"] | null {
  if (!schedule) {
    return null;
  }
  if (schedule.kind === "every") {
    if (typeof schedule.everyMs !== "number" || !Number.isFinite(schedule.everyMs) || schedule.everyMs <= 0) {
      return null;
    }
    return { kind: "every", everyMs: schedule.everyMs };
  }
  if (schedule.kind === "at") {
    if (typeof schedule.atMs !== "number" || !Number.isFinite(schedule.atMs)) {
      return null;
    }
    return { kind: "at", atMs: schedule.atMs };
  }
  if (schedule.kind === "cron") {
    const expr = readNonEmptyString(schedule.expr);
    if (!expr) {
      return null;
    }
    const tz = readNonEmptyString(schedule.tz);
    return tz ? { kind: "cron", expr, tz } : { kind: "cron", expr };
  }
  return null;
}

function readCronCreateParams(input: CronCreateRequest): { params: CronCreateParams } | { error: string } {
  const name = readNonEmptyString(input.name);
  if (!name) {
    return { error: "name must be a non-empty string" };
  }
  const message = readNonEmptyString(input.message);
  if (!message) {
    return { error: "message must be a non-empty string" };
  }
  const schedule = normalizeCronSchedule(input.schedule);
  if (!schedule) {
    return { error: "schedule must be a valid at/every/cron definition" };
  }
  return {
    params: {
      name,
      message,
      schedule,
      agentId: readNonEmptyString(input.agentId),
      deliver: input.deliver === true,
      channel: readNonEmptyString(input.channel),
      to: readNonEmptyString(input.to),
      accountId: readNonEmptyString(input.accountId),
      deleteAfterRun: input.deleteAfterRun === true
    }
  };
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

  readonly createJob = async (c: Context) => {
    if (!this.options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const body = await readJson<CronCreateRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const normalized = readCronCreateParams(body.data);
    if ("error" in normalized) {
      return c.json(err("INVALID_BODY", normalized.error), 400);
    }
    const job = this.options.cronService.addJob(normalized.params);
    const data: CronCreateResult = { job: buildCronJobView(job as CronJobEntry) };
    return c.json(ok(data), 201);
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
