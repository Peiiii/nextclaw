import type { Context } from "hono";
import type {
  CronActionResult,
  CronCreateRequest,
  CronCreateResult,
  CronEnableRequest,
  CronJobView,
  CronListStatus,
  CronRunRequest
} from "@nextclaw-server/shared/types/server-api.types.js";
import { err, ok, readJson, readNonEmptyString } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { CronJobEntry, UiCronHost, UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";

const CRON_LIST_MAX_LIMIT = 100;
const CRON_LIST_STATUSES = new Set<CronListStatus>(["all", "enabled", "disabled", "attention"]);

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

function readCronListInteger(
  rawValue: string | undefined,
  name: "limit" | "offset",
  minimum: number,
  maximum: number,
): { value: number | null } | { error: string } {
  if (rawValue === undefined) {
    return { value: null };
  }
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return { error: `${name} must be an integer between ${minimum} and ${maximum}` };
  }
  return { value };
}

function readCronListStatus(query: Record<string, string>): CronListStatus | null {
  if (query.status) {
    const status = query.status as CronListStatus;
    return CRON_LIST_STATUSES.has(status) ? status : null;
  }
  const enabledOnly =
    query.enabledOnly === "1" ||
    query.enabledOnly === "true" ||
    query.enabledOnly === "yes" ||
    query.all === "0" ||
    query.all === "false" ||
    query.all === "no";
  return enabledOnly ? "enabled" : "all";
}

function matchesCronListStatus(job: CronJobView, status: CronListStatus): boolean {
  if (status === "enabled") {
    return job.enabled;
  }
  if (status === "disabled") {
    return !job.enabled;
  }
  if (status === "attention") {
    return job.state.lastStatus === "error";
  }
  return true;
}

function matchesCronListQuery(job: CronJobView, query: string): boolean {
  if (!query) {
    return true;
  }
  return [
    job.id,
    job.name,
    job.payload.message,
    job.payload.agentId ?? "",
    job.payload.sessionId ?? "",
  ].some((value) => value.toLowerCase().includes(query));
}

function findCronJob(service: UiCronHost, id: string): CronJobEntry | null {
  const jobs = service.listJobs(true);
  return jobs.find((job) => job.id === id) ?? null;
}

type CronCreateParams = Parameters<UiCronHost["addJob"]>[0];
type CronCreateInput = CronCreateRequest & Record<string, unknown>;
const legacyCronDeliveryKeys = ["deliver", "channel", "to", "accountId", "account_id"] as const;

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

function readLegacyDeliveryKey(input: Record<string, unknown>): string | null {
  return legacyCronDeliveryKeys.find((key) => input[key] !== undefined) ?? null;
}

function readCronCreateParams(input: CronCreateInput): { params: CronCreateParams } | { error: string } {
  const legacyDeliveryKey = readLegacyDeliveryKey(input);
  if (legacyDeliveryKey) {
    return { error: `cron jobs do not accept ${legacyDeliveryKey}; put delivery instructions in message and use the message tool at run time` };
  }
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
      sessionId: readNonEmptyString(input.sessionId),
      deleteAfterRun: input.deleteAfterRun === true
    }
  };
}

export class CronRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly listJobs = (c: Context) => {
    if (!this.options.cron) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const query = c.req.query();
    const status = readCronListStatus(query);
    if (!status) {
      return c.json(err("INVALID_QUERY", "status must be all, enabled, disabled, or attention"), 400);
    }
    const limitResult = readCronListInteger(query.limit, "limit", 1, CRON_LIST_MAX_LIMIT);
    if ("error" in limitResult) {
      return c.json(err("INVALID_QUERY", limitResult.error), 400);
    }
    const offsetResult = readCronListInteger(query.offset, "offset", 0, Number.MAX_SAFE_INTEGER);
    if ("error" in offsetResult) {
      return c.json(err("INVALID_QUERY", offsetResult.error), 400);
    }
    if (offsetResult.value !== null && limitResult.value === null) {
      return c.json(err("INVALID_QUERY", "offset requires limit"), 400);
    }

    const allJobs = this.options.cron.listJobs(true).map((job) => buildCronJobView(job as CronJobEntry));
    const enabled = allJobs.filter((job) => job.enabled).length;
    const normalizedQuery = query.query?.trim().toLowerCase() ?? "";
    const filteredJobs = allJobs.filter(
      (job) => matchesCronListStatus(job, status) && matchesCronListQuery(job, normalizedQuery),
    );
    const offset = offsetResult.value ?? 0;
    const jobs = limitResult.value === null
      ? filteredJobs
      : filteredJobs.slice(offset, offset + limitResult.value);
    return c.json(ok({
      jobs,
      total: filteredJobs.length,
      summary: {
        total: allJobs.length,
        enabled,
        disabled: allJobs.length - enabled,
        attention: allJobs.filter((job) => job.state.lastStatus === "error").length,
      },
    }));
  };

  readonly createJob = async (c: Context) => {
    if (!this.options.cron) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const body = await readJson<CronCreateInput>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const normalized = readCronCreateParams(body.data);
    if ("error" in normalized) {
      return c.json(err("INVALID_BODY", normalized.error), 400);
    }
    const job = this.options.cron.addJob(normalized.params);
    const data: CronCreateResult = { job: buildCronJobView(job as CronJobEntry) };
    return c.json(ok(data), 201);
  };

  readonly deleteJob = (c: Context) => {
    if (!this.options.cron) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const deleted = this.options.cron.removeJob(id);
    if (!deleted) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    return c.json(ok({ deleted: true }));
  };

  readonly enableJob = async (c: Context) => {
    if (!this.options.cron) {
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
    const job = this.options.cron.enableJob(id, body.data.enabled);
    if (!job) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    const data: CronActionResult = { job: buildCronJobView(job as CronJobEntry) };
    return c.json(ok(data));
  };

  readonly runJob = async (c: Context) => {
    if (!this.options.cron) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const body = await readJson<CronRunRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const existing = findCronJob(this.options.cron, id);
    if (!existing) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    const executed = await this.options.cron.runJob(id, Boolean(body.data.force));
    const after = findCronJob(this.options.cron, id);
    const data: CronActionResult = {
      job: after ? buildCronJobView(after) : null,
      executed
    };
    return c.json(ok(data));
  };
}
