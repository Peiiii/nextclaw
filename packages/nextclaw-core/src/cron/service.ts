import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import cronParser from "cron-parser";
import type { CronJob, CronJobState, CronPayload, CronSchedule, CronStore } from "./types.js";

const nowMs = () => Date.now();

function formatBackgroundTaskError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function normalizeFiniteMs(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function computeEveryNextRun(everyMs: number | null | undefined, now: number, anchorMs?: number | null): number | null {
  if (!everyMs || everyMs <= 0) {
    return null;
  }
  const normalizedAnchor = normalizeFiniteMs(anchorMs);
  if (normalizedAnchor === null) {
    return now + everyMs;
  }
  if (normalizedAnchor > now) {
    return normalizedAnchor;
  }
  const intervalsToAdvance = Math.floor((now - normalizedAnchor) / everyMs) + 1;
  return normalizedAnchor + intervalsToAdvance * everyMs;
}

function computeNextRun(schedule: CronSchedule, now: number, anchorMs?: number | null): number | null {
  if (schedule.kind === "at") {
    return schedule.atMs && schedule.atMs > now ? schedule.atMs : null;
  }
  if (schedule.kind === "every") {
    return computeEveryNextRun(schedule.everyMs, now, anchorMs);
  }
  if (schedule.kind === "cron" && schedule.expr) {
    try {
      const interval = cronParser.parseExpression(schedule.expr, { currentDate: new Date(now) });
      return interval.next().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

function serializeStore(store: CronStore): string {
  return JSON.stringify(store, null, 2);
}

export class CronService {
  private store: CronStore | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastPersistedStoreJson: string | null = null;
  private storeExistsOnDisk = false;
  onJob?: (job: CronJob) => Promise<string | null>;

  constructor(private storePath: string, onJob?: (job: CronJob) => Promise<string | null>) {
    this.onJob = onJob;
  }

  private readonly loadStore = (): CronStore => {
    if (this.store) {
      return this.store;
    }
    if (existsSync(this.storePath)) {
      try {
        const data = JSON.parse(readFileSync(this.storePath, "utf-8"));
        const jobs = (data.jobs ?? []).map((job: Record<string, unknown>) => ({
          id: String(job.id),
          name: String(job.name),
          enabled: Boolean(job.enabled ?? true),
          schedule: (job.schedule ?? {}) as CronSchedule,
          payload: (job.payload ?? {}) as CronPayload,
          state: (job.state ?? {}) as CronJobState,
          createdAtMs: Number(job.createdAtMs ?? 0),
          updatedAtMs: Number(job.updatedAtMs ?? 0),
          deleteAfterRun: Boolean(job.deleteAfterRun ?? false)
        }));
        this.store = { version: data.version ?? 1, jobs };
        this.storeExistsOnDisk = true;
      } catch {
        this.store = { version: 1, jobs: [] };
        this.storeExistsOnDisk = false;
      }
    } else {
      this.store = { version: 1, jobs: [] };
      this.storeExistsOnDisk = false;
    }
    this.lastPersistedStoreJson = serializeStore(this.store);
    return this.store;
  };

  private readonly saveStore = (): void => {
    if (!this.store) {
      return;
    }
    const nextStoreJson = serializeStore(this.store);
    if (this.storeExistsOnDisk && this.lastPersistedStoreJson === nextStoreJson) {
      return;
    }
    mkdirSync(dirname(this.storePath), { recursive: true });
    writeFileSync(this.storePath, nextStoreJson);
    this.lastPersistedStoreJson = nextStoreJson;
    this.storeExistsOnDisk = true;
  };

  readonly start = async (): Promise<void> => {
    this.running = true;
    this.loadStore();
    this.recomputeNextRuns();
    this.saveStore();
    this.armTimer();
  };

  readonly stop = (): void => {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  };

  readonly reloadFromStore = (): void => {
    this.store = null;
    this.loadStore();
    this.recomputeNextRunsForMaintenance();
    this.saveStore();
    this.armTimer();
  };

  private readonly resolveEveryResumeAnchor = (job: CronJob): number | null => {
    const persistedNextRun = normalizeFiniteMs(job.state.nextRunAtMs);
    if (persistedNextRun !== null) {
      return persistedNextRun;
    }
    if (job.schedule.kind !== "every") {
      return null;
    }
    const everyMs = normalizeFiniteMs(job.schedule.everyMs);
    const lastRunAtMs = normalizeFiniteMs(job.state.lastRunAtMs);
    if (everyMs === null || lastRunAtMs === null) {
      return null;
    }
    return lastRunAtMs + everyMs;
  };

  private readonly recomputeNextRuns = (): void => {
    if (!this.store) {
      return;
    }
    const now = nowMs();
    for (const job of this.store.jobs) {
      if (job.enabled) {
        job.state.nextRunAtMs = computeNextRun(job.schedule, now, this.resolveEveryResumeAnchor(job));
      }
    }
  };

  private readonly recomputeNextRunsForMaintenance = (recomputeExpired = false): void => {
    if (!this.store) {
      return;
    }
    const now = nowMs();
    for (const job of this.store.jobs) {
      if (!job.enabled) {
        continue;
      }
      const nextRunAtMs = normalizeFiniteMs(job.state.nextRunAtMs);
      if (nextRunAtMs === null) {
        job.state.nextRunAtMs = computeNextRun(job.schedule, now, this.resolveEveryResumeAnchor(job));
        continue;
      }
      if (!recomputeExpired || now < nextRunAtMs) {
        continue;
      }
      const lastRunAtMs = normalizeFiniteMs(job.state.lastRunAtMs);
      const alreadyExecutedScheduledSlot = lastRunAtMs !== null && lastRunAtMs >= nextRunAtMs;
      if (alreadyExecutedScheduledSlot) {
        job.state.nextRunAtMs = computeNextRun(job.schedule, now, this.resolveEveryResumeAnchor(job));
      }
    }
  };

  private readonly getNextWakeMs = (): number | null => {
    if (!this.store) {
      return null;
    }
    const times = this.store.jobs
      .filter((job) => job.enabled && job.state.nextRunAtMs)
      .map((job) => job.state.nextRunAtMs as number);
    if (!times.length) {
      return null;
    }
    return Math.min(...times);
  };

  private readonly armTimer = (): void => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    if (!this.running) {
      return;
    }
    const nextWake = this.getNextWakeMs();
    if (!nextWake) {
      return;
    }
    const delayMs = Math.max(0, nextWake - nowMs());
    this.timer = setTimeout(() => {
      void this.runTimerSafely();
    }, delayMs);
  };

  private readonly runTimerSafely = async (): Promise<void> => {
    try {
      await this.onTimer();
    } catch (error) {
      console.error(`[cron] background timer failed: ${formatBackgroundTaskError(error)}`);
      this.armTimer();
    }
  };

  private readonly onTimer = async (): Promise<void> => {
    if (!this.store) {
      return;
    }
    const now = nowMs();
    const dueJobs = this.store.jobs.filter(
      (job) => job.enabled && job.state.nextRunAtMs && now >= (job.state.nextRunAtMs ?? 0)
    );

    for (const job of dueJobs) {
      await this.executeJob(job);
    }

    this.saveStore();
    this.armTimer();
  };

  private readonly executeJob = async (job: CronJob): Promise<void> => {
    const start = nowMs();
    const previousNextRunAtMs = normalizeFiniteMs(job.state.nextRunAtMs);
    try {
      if (this.onJob) {
        await this.onJob(job);
      }
      job.state.lastStatus = "ok";
      job.state.lastError = null;
    } catch (err) {
      job.state.lastStatus = "error";
      job.state.lastError = String(err);
    }
    job.state.lastRunAtMs = start;
    job.updatedAtMs = nowMs();
    if (job.schedule.kind === "at") {
      if (job.deleteAfterRun) {
        if (this.store) {
          this.store.jobs = this.store.jobs.filter((existing) => existing.id !== job.id);
        }
      } else {
        job.enabled = false;
        job.state.nextRunAtMs = null;
      }
    } else {
      job.state.nextRunAtMs = computeNextRun(job.schedule, nowMs(), previousNextRunAtMs);
    }
  };

  readonly listJobs = (includeDisabled = false): CronJob[] => {
    const store = this.loadStore();
    const jobs = includeDisabled ? store.jobs : store.jobs.filter((job) => job.enabled);
    return jobs.sort((a, b) => (a.state.nextRunAtMs ?? Infinity) - (b.state.nextRunAtMs ?? Infinity));
  };

  readonly addJob = (params: {
    name: string;
    schedule: CronSchedule;
    message: string;
    agentId?: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
    accountId?: string;
    deleteAfterRun?: boolean;
  }): CronJob => {
    const store = this.loadStore();
    const now = nowMs();
    const job: CronJob = {
      id: randomUUID().slice(0, 8),
      name: params.name,
      enabled: true,
      schedule: params.schedule,
      payload: {
        kind: "agent_turn",
        message: params.message,
        agentId: params.agentId,
        deliver: params.deliver ?? false,
        channel: params.channel,
        to: params.to,
        accountId: params.accountId
      },
      state: {
        nextRunAtMs: computeNextRun(params.schedule, now)
      },
      createdAtMs: now,
      updatedAtMs: now,
      deleteAfterRun: params.deleteAfterRun ?? false
    };
    store.jobs.push(job);
    this.saveStore();
    this.armTimer();
    return job;
  };

  readonly removeJob = (jobId: string): boolean => {
    const store = this.loadStore();
    const before = store.jobs.length;
    store.jobs = store.jobs.filter((job) => job.id !== jobId);
    const removed = store.jobs.length < before;
    if (removed) {
      this.saveStore();
      this.armTimer();
    }
    return removed;
  };

  readonly enableJob = (jobId: string, enabled = true): CronJob | null => {
    const store = this.loadStore();
    for (const job of store.jobs) {
      if (job.id === jobId) {
        job.enabled = enabled;
        job.updatedAtMs = nowMs();
        job.state.nextRunAtMs = enabled ? computeNextRun(job.schedule, nowMs()) : null;
        this.saveStore();
        this.armTimer();
        return job;
      }
    }
    return null;
  };

  readonly runJob = async (jobId: string, force = false): Promise<boolean> => {
    const store = this.loadStore();
    for (const job of store.jobs) {
      if (job.id === jobId) {
        if (!force && !job.enabled) {
          return false;
        }
        await this.executeJob(job);
        this.saveStore();
        this.armTimer();
        return true;
      }
    }
    return false;
  };

  readonly status = (): { enabled: boolean; jobs: number; nextWakeAtMs: number | null } => {
    const store = this.loadStore();
    return {
      enabled: this.running,
      jobs: store.jobs.length,
      nextWakeAtMs: this.getNextWakeMs()
    };
  };
}
