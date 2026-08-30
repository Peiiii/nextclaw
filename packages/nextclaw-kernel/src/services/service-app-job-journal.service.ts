import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ServiceAppJobCaller,
  ServiceAppJobChunkEvent,
  ServiceAppJobEvent,
  ServiceAppJobList,
  ServiceAppJobProgressEvent,
  ServiceAppJobStatus,
  ServiceAppJobTerminalEvent,
  ServiceAppJobView,
  ServiceAppJobWatch,
  ServiceAppTerminalJobStatus,
} from "@kernel/types/service-app.types.js";
import { ServiceAppError } from "@kernel/utils/service-app-error.utils.js";

const STORE_FILE_NAME = "service-jobs.json";
const MAX_EVENTS_PER_JOB = 256;
const MAX_EVENT_BYTES_PER_JOB = 1024 * 1024;
const MAX_PROGRESS_PER_SECOND = 10;
const SERVICE_APP_JOB_STATUSES = new Set<ServiceAppJobStatus>([
  "queued", "starting", "running", "succeeded", "cancel-requested",
  "cancelled", "timed-out", "failed", "interrupted",
]);

export type ServiceAppJobScope = {
  appId: string;
  instanceId: string;
  stateDirectory: string;
};

type StoredJob = ServiceAppJobView & { events: ServiceAppJobEvent[] };
type JobEventInput = ServiceAppJobProgressEvent | ServiceAppJobChunkEvent | ServiceAppJobTerminalEvent;

type JobStore = {
  schemaVersion: 1;
  jobs: StoredJob[];
};

export type ServiceAppJobEventSink = {
  reportProgress: (input: {
    current?: number;
    total?: number;
    message?: string;
  }) => Promise<ServiceAppJobEvent | undefined>;
  emitChunk: (content: string) => Promise<ServiceAppJobEvent>;
  recordTerminal: (input: {
    status: ServiceAppTerminalJobStatus;
    error?: { code?: string; message: string };
  }) => Promise<ServiceAppJobView>;
};

/**
 * The only durable owner for Service App Job state and stream facts.
 *
 * A journal belongs to one installed App instance, so user-visible work never
 * crosses an App's `stateDirectory`. Verification records deliberately stay
 * elsewhere and only retain redacted acceptance evidence.
 */
export class ServiceAppJobJournalService {
  private readonly stores = new Map<string, Map<string, StoredJob>>();
  private readonly loadPromises = new Map<string, Promise<void>>();
  private readonly mutationQueues = new Map<string, Promise<unknown>>();
  private readonly lastProgressAt = new Map<string, number>();

  queue = async (scope: ServiceAppJobScope, input: {
    actionName: string;
    componentId?: string;
    callId: string;
    traceId: string;
    caller?: ServiceAppJobCaller;
    retryOf?: string;
    jobId?: string;
  }): Promise<ServiceAppJobView> => {
    await this.ensureLoaded(scope);
    const now = new Date().toISOString();
    const job: StoredJob = {
      id: input.jobId ?? randomUUID(),
      appId: scope.appId,
      instanceId: scope.instanceId,
      componentId: input.componentId ?? scope.appId,
      actionName: input.actionName,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      callId: input.callId,
      traceId: input.traceId,
      caller: input.caller ? { ...input.caller } : undefined,
      retryOf: input.retryOf,
      events: [],
    };
    await this.mutate(scope, (jobs) => {
      if (jobs.has(job.id)) {
        throw new ServiceAppError("SERVICE_APP_JOB_CONFLICT", `Service App Job ${job.id} already exists.`);
      }
      jobs.set(job.id, job);
    });
    return this.toView(job);
  };

  get = async (scope: ServiceAppJobScope, jobId: string): Promise<ServiceAppJobView> =>
    this.toView(await this.requireJob(scope, jobId));

  list = async (scope: ServiceAppJobScope): Promise<ServiceAppJobList> => {
    await this.ensureLoaded(scope);
    return {
      entries: [...this.requireStore(scope).values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((job) => this.toView(job)),
    };
  };

  watch = async (scope: ServiceAppJobScope, jobId: string, afterSequence?: number): Promise<ServiceAppJobWatch> => {
    const job = await this.requireJob(scope, jobId);
    const firstSequence = job.events[0]?.sequence;
    if (afterSequence !== undefined && (!Number.isInteger(afterSequence) || afterSequence < 0)) {
      throw new ServiceAppError("SERVICE_APP_JOB_CURSOR_INVALID", "afterSequence must be a non-negative integer.");
    }
    if (afterSequence !== undefined && firstSequence !== undefined && afterSequence < firstSequence - 1) {
      throw new ServiceAppError(
        "STREAM_CURSOR_EXPIRED",
        `Job event cursor ${afterSequence} is outside the retained journal window.`,
        { oldestSequence: firstSequence, newestSequence: job.events.at(-1)?.sequence ?? 0 },
      );
    }
    const events = afterSequence === undefined
      ? job.events
      : job.events.filter((event) => event.sequence > afterSequence);
    return {
      job: this.toView(job),
      events: events.map((event) => this.cloneEvent(event)),
      cursor: job.events.at(-1)?.sequence ?? 0,
    };
  };

  transition = async (scope: ServiceAppJobScope, jobId: string, status: Exclude<ServiceAppJobStatus, ServiceAppTerminalJobStatus>): Promise<ServiceAppJobView> => {
    let updated: StoredJob | undefined;
    await this.mutate(scope, (jobs) => {
      const job = this.requireJobFromStore(jobs, jobId);
      this.assertCanTransition(job, status);
      const now = new Date().toISOString();
      job.status = status;
      job.updatedAt = now;
      if (status === "starting" && !job.startedAt) job.startedAt = now;
      if (status === "cancel-requested") job.cancelRequestedAt = now;
      updated = job;
    });
    return this.toView(updated!);
  };

  requestCancel = async (scope: ServiceAppJobScope, jobId: string): Promise<ServiceAppJobView> =>
    await this.transition(scope, jobId, "cancel-requested");

  recordTerminal = async (scope: ServiceAppJobScope, jobId: string, input: {
    status: ServiceAppTerminalJobStatus;
    error?: { code?: string; message: string };
  }): Promise<ServiceAppJobView> => {
    let updated: StoredJob | undefined;
    await this.mutate(scope, (jobs) => {
      const job = this.requireJobFromStore(jobs, jobId);
      this.assertCanTransition(job, input.status);
      const now = new Date().toISOString();
      job.status = input.status;
      job.updatedAt = now;
      job.completedAt = now;
      job.error = input.error ? { ...input.error } : undefined;
      this.appendEvent(job, {
        type: "terminal",
        status: input.status,
        error: input.error ? { ...input.error } : undefined,
      }, now);
      updated = job;
    });
    return this.toView(updated!);
  };

  reportProgress = async (scope: ServiceAppJobScope, jobId: string, input: {
    current?: number;
    total?: number;
    message?: string;
  }): Promise<ServiceAppJobEvent | undefined> => {
    const throttleKey = this.jobKey(scope, jobId);
    const nowMs = Date.now();
    const minimumIntervalMs = 1000 / MAX_PROGRESS_PER_SECOND;
    if (nowMs - (this.lastProgressAt.get(throttleKey) ?? 0) < minimumIntervalMs) return undefined;
    let event: ServiceAppJobEvent | undefined;
    await this.mutate(scope, (jobs) => {
      const job = this.requireJobFromStore(jobs, jobId);
      this.assertActive(job);
      event = this.appendEvent(job, {
        type: "progress",
        current: input.current,
        total: input.total,
        message: input.message,
      });
      this.lastProgressAt.set(throttleKey, nowMs);
    });
    return event ? this.cloneEvent(event) : undefined;
  };

  emitChunk = async (scope: ServiceAppJobScope, jobId: string, content: string): Promise<ServiceAppJobEvent> => {
    let event: ServiceAppJobEvent | undefined;
    await this.mutate(scope, (jobs) => {
      const job = this.requireJobFromStore(jobs, jobId);
      this.assertActive(job);
      event = this.appendEvent(job, { type: "stream-chunk", content });
    });
    return this.cloneEvent(event!);
  };

  createEventSink = (scope: ServiceAppJobScope, jobId: string): ServiceAppJobEventSink =>
    new JournalEventSink(this, scope, jobId);

  /** Marks durable in-flight work as interrupted after a host restart. */
  recoverUnfinished = async (scopes: readonly ServiceAppJobScope[]): Promise<void> => {
    for (const scope of scopes) {
      await this.ensureLoaded(scope);
      const candidates = [...this.requireStore(scope).values()]
        .filter((job) => !this.isTerminal(job.status));
      for (const job of candidates) {
        await this.recordTerminal(scope, job.id, {
          status: "interrupted",
          error: { code: "HOST_RESTARTED", message: "The NextClaw host restarted before this Job completed." },
        });
      }
    }
  };

  private requireJob = async (scope: ServiceAppJobScope, jobId: string): Promise<StoredJob> => {
    await this.ensureLoaded(scope);
    return this.requireJobFromStore(this.requireStore(scope), jobId);
  };

  private requireJobFromStore = (jobs: Map<string, StoredJob>, jobId: string): StoredJob => {
    const job = jobs.get(jobId);
    if (!job) throw new ServiceAppError("SERVICE_APP_JOB_NOT_FOUND", `Service App Job ${jobId} was not found.`);
    return job;
  };

  private assertCanTransition = (job: StoredJob, next: ServiceAppJobStatus): void => {
    if (this.isTerminal(job.status)) {
      throw new ServiceAppError("SERVICE_APP_JOB_TERMINAL", `Service App Job ${job.id} is already terminal.`);
    }
    const allowed: Record<Exclude<ServiceAppJobStatus, ServiceAppTerminalJobStatus>, readonly ServiceAppJobStatus[]> = {
      queued: ["starting", "cancel-requested", "interrupted", "failed"],
      starting: ["running", "cancel-requested", "interrupted", "failed", "timed-out"],
      running: ["succeeded", "cancel-requested", "timed-out", "failed", "interrupted"],
      "cancel-requested": ["cancelled", "failed", "interrupted"],
    };
    if (!allowed[job.status].includes(next)) {
      throw new ServiceAppError(
        "SERVICE_APP_JOB_TERMINAL",
        `Service App Job ${job.id} cannot transition from ${job.status} to ${next}.`,
      );
    }
  };

  private assertActive = (job: StoredJob): void => {
    if (job.status !== "running") {
      throw new ServiceAppError("SERVICE_APP_JOB_TERMINAL", `Service App Job ${job.id} is not running.`);
    }
  };

  private appendEvent = (
    job: StoredJob,
    event: JobEventInput,
    timestamp = new Date().toISOString(),
  ): ServiceAppJobEvent => {
    const next: ServiceAppJobEvent = {
      ...event,
      sequence: (job.events.at(-1)?.sequence ?? 0) + 1,
      timestamp,
    } as ServiceAppJobEvent;
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > MAX_EVENT_BYTES_PER_JOB) {
      throw new ServiceAppError(
        "STREAM_BACKPRESSURE_TIMEOUT",
        `Service App Job ${job.id} emitted an event larger than the ${MAX_EVENT_BYTES_PER_JOB} byte journal limit.`,
      );
    }
    job.events.push(next);
    while (
      job.events.length > MAX_EVENTS_PER_JOB ||
      this.eventBytes(job.events) > MAX_EVENT_BYTES_PER_JOB
    ) job.events.shift();
    return next;
  };

  private ensureLoaded = async (scope: ServiceAppJobScope): Promise<void> => {
    const key = scope.stateDirectory;
    let loadPromise = this.loadPromises.get(key);
    if (!loadPromise) {
      loadPromise = this.load(scope);
      this.loadPromises.set(key, loadPromise);
    }
    await loadPromise;
  };

  private load = async (scope: ServiceAppJobScope): Promise<void> => {
    const jobs = new Map<string, StoredJob>();
    try {
      const parsed = JSON.parse(await readFile(this.storePath(scope), "utf8")) as unknown;
      if (this.isStore(parsed)) {
        for (const job of parsed.jobs) if (this.isJob(job, scope)) jobs.set(job.id, job);
      }
    } catch (error) {
      if (!this.isMissing(error)) throw error;
    }
    this.stores.set(scope.stateDirectory, jobs);
  };

  private mutate = async (scope: ServiceAppJobScope, operation: (jobs: Map<string, StoredJob>) => void): Promise<void> => {
    await this.ensureLoaded(scope);
    const key = scope.stateDirectory;
    const current = (this.mutationQueues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        operation(this.requireStore(scope));
        await this.save(scope);
      });
    this.mutationQueues.set(key, current);
    await current;
  };

  private save = async (scope: ServiceAppJobScope): Promise<void> => {
    const target = this.storePath(scope);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const staged = `${target}.${process.pid}.${Date.now()}.tmp`;
    const store: JobStore = {
      schemaVersion: 1,
      jobs: [...this.requireStore(scope).values()],
    };
    await writeFile(staged, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(staged, target);
    await chmod(target, 0o600);
  };

  private requireStore = (scope: ServiceAppJobScope): Map<string, StoredJob> => {
    const store = this.stores.get(scope.stateDirectory);
    if (!store) throw new Error(`Service App Job journal ${scope.stateDirectory} was not loaded.`);
    return store;
  };

  private toView = (job: StoredJob): ServiceAppJobView => {
    const { events: _events, caller, error, ...view } = job;
    return {
      ...view,
      caller: caller ? { ...caller } : undefined,
      error: error ? { ...error } : undefined,
    };
  };

  private cloneEvent = (event: ServiceAppJobEvent): ServiceAppJobEvent =>
    event.type === "terminal"
      ? { ...event, error: event.error ? { ...event.error } : undefined }
      : { ...event };

  private isTerminal = (status: ServiceAppJobStatus): status is ServiceAppTerminalJobStatus =>
    ["succeeded", "cancelled", "timed-out", "failed", "interrupted"].includes(status);

  private eventBytes = (events: readonly ServiceAppJobEvent[]): number =>
    Buffer.byteLength(JSON.stringify(events), "utf8");

  private storePath = (scope: ServiceAppJobScope): string => path.join(scope.stateDirectory, STORE_FILE_NAME);

  private jobKey = (scope: ServiceAppJobScope, jobId: string): string => `${scope.stateDirectory}:${jobId}`;

  private isStore = (value: unknown): value is JobStore => Boolean(value) && typeof value === "object" &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1 && Array.isArray((value as { jobs?: unknown }).jobs);

  private isJob = (value: unknown, scope: ServiceAppJobScope): value is StoredJob => {
    if (!value || typeof value !== "object") return false;
    const job = value as Partial<StoredJob>;
    return typeof job.id === "string" &&
      job.appId === scope.appId &&
      job.instanceId === scope.instanceId &&
      typeof job.componentId === "string" &&
      typeof job.actionName === "string" &&
      typeof job.status === "string" &&
      SERVICE_APP_JOB_STATUSES.has(job.status as ServiceAppJobStatus) &&
      typeof job.createdAt === "string" &&
      typeof job.updatedAt === "string" &&
      typeof job.callId === "string" &&
      typeof job.traceId === "string" &&
      Array.isArray(job.events) &&
      job.events.every((event) => this.isEvent(event));
  };

  private isEvent = (value: unknown): value is ServiceAppJobEvent => {
    if (!value || typeof value !== "object") return false;
    const event = value as Partial<ServiceAppJobEvent>;
    if (!Number.isInteger(event.sequence) || (event.sequence ?? 0) < 1 || typeof event.timestamp !== "string") {
      return false;
    }
    if (event.type === "progress") return true;
    if (event.type === "stream-chunk") return typeof event.content === "string";
    return event.type === "terminal" && typeof event.status === "string" &&
      this.isTerminal(event.status as ServiceAppJobStatus);
  };

  private isMissing = (error: unknown): boolean =>
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT";
}

class JournalEventSink implements ServiceAppJobEventSink {
  constructor(
    private readonly journal: ServiceAppJobJournalService,
    private readonly scope: ServiceAppJobScope,
    private readonly jobId: string,
  ) {}

  reportProgress: ServiceAppJobEventSink["reportProgress"] = async (input) =>
    await this.journal.reportProgress(this.scope, this.jobId, input);
  emitChunk: ServiceAppJobEventSink["emitChunk"] = async (content) =>
    await this.journal.emitChunk(this.scope, this.jobId, content);
  recordTerminal: ServiceAppJobEventSink["recordTerminal"] = async (input) =>
    await this.journal.recordTerminal(this.scope, this.jobId, input);
}
