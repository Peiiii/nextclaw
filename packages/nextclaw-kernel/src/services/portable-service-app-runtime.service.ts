import type {
  ServiceAction,
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import type { Config } from "@nextclaw/core";
import {
  PortableServiceRunnerError,
  PortableServiceRunnerClientService,
  type PortableRunnerJobEvent,
  type PortableRunnerApp,
  type PortableRunnerHostCallHandler,
} from "@kernel/services/portable-service-runner-client.service.js";
import { PortableServiceCapabilityResolverService } from "@kernel/services/portable-service-capability-resolver.service.js";
import type { ServiceAppJobEventSink } from "@kernel/services/service-app-job-journal.service.js";
import {
  normalizeResidentDisposition,
  requireResidentInboxScope,
  ServiceAppResidentEventInboxService,
} from "@kernel/services/service-app-resident-event-inbox.service.js";
import type {
  PortableActiveHostJob as ActiveHostJob,
  PortablePersistentRegistration as PersistentRegistration,
  PortableRuntimeState as RuntimeState,
  PortableServiceAppHostCall,
  PortableServiceAppHostCallHandler,
} from "@kernel/types/portable-service-app-runtime.types.js";
export type { PortableServiceAppHostCall, PortableServiceAppHostCallHandler } from "@kernel/types/portable-service-app-runtime.types.js";
import {
  buildServiceActionId,
  DEFAULT_SERVICE_ACTION_RISK,
} from "@kernel/utils/service-action.utils.js";

export class PortableServiceAppRuntimeService {
  private readonly runner: PortableServiceRunnerClientService;
  private readonly states = new Map<string, RuntimeState>();
  private readonly apps = new Map<string, PortableRunnerApp>();
  private readonly providers = new Set<string>();
  private readonly persistentRegistrations = new Map<
    string,
    PersistentRegistration
  >();
  private readonly residentTimers = new Map<string, NodeJS.Timeout>();
  private readonly residentDeliveries = new Map<string, Promise<void>>();
  private readonly residentInbox: ServiceAppResidentEventInboxService;
  private readonly activeHostJobs = new Map<
    string,
    ActiveHostJob
  >();
  private readonly capabilityResolver: PortableServiceCapabilityResolverService;
  private recoveryPromise?: Promise<void>;
  private hostCallHandler?: PortableServiceAppHostCallHandler;

  constructor(params: {
    appHomeDirectory?: string;
    runnerPath?: string;
    getSecretConfig?: () => Config;
    secretConfigPath?: string;
    residentInbox?: ServiceAppResidentEventInboxService;
  } = {}) {
    this.runner = new PortableServiceRunnerClientService({
      runnerPath: params.runnerPath,
      onUnexpectedExit: (error) => {
        void this.recoverPersistentComponentsIfNeeded(error);
      },
    });
    this.capabilityResolver = new PortableServiceCapabilityResolverService(params);
    this.residentInbox = params.residentInbox ?? new ServiceAppResidentEventInboxService();
  }

  getStatus = (appId: string): RuntimeState =>
    this.states.get(appId) ?? { status: "idle" };

  getLastObservation = () => this.runner.getLastObservation();

  setHostCallHandler = (handler: PortableServiceAppHostCallHandler | undefined): void => {
    this.hostCallHandler = handler;
  };

  start = async ({
    app,
    manifest,
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
  }): Promise<void> => {
    if (
      !app.enabled ||
      !manifest.lifecycle ||
      manifest.lifecycle.mode === "action"
    )
      return;
    const runnerApp = await this.resolveRunnerApp(app, app.providerIds);
    this.persistentRegistrations.set(app.id, { app, manifest });
    if (manifest.lifecycle.mode === "provider") {
      if (this.providers.has(app.id)) return;
      const lastStartedAt = new Date().toISOString();
      this.states.set(app.id, { status: "starting", lastStartedAt });
      try {
        await this.runner.startProvider(runnerApp, {
          mode: "provider",
          startedAt: lastStartedAt,
        });
        this.providers.add(app.id);
        this.states.set(app.id, {
          status: "running",
          lastStartedAt,
          lastReadyAt: new Date().toISOString(),
        });
      } catch (error) {
        this.markFailed(app.id, lastStartedAt, error);
        throw error;
      }
      return;
    }
    if (this.residentTimers.has(app.id)) return;
    const lastStartedAt = new Date().toISOString();
    this.states.set(app.id, { status: "starting", lastStartedAt });
    try {
      await this.runner.startResident(runnerApp, {
        eventIntervalMs: manifest.lifecycle.eventIntervalMs,
        startedAt: lastStartedAt,
      });
      await this.residentInbox.resume(requireResidentInboxScope(app));
      const timer = setInterval(() => {
        this.scheduleResidentEvent({
          appId: app.id,
          eventIntervalMs:
            manifest.lifecycle?.mode === "resident"
              ? manifest.lifecycle.eventIntervalMs
              : 0,
        });
      }, manifest.lifecycle.eventIntervalMs);
      timer.unref();
      this.residentTimers.set(app.id, timer);
      // Recovery does not invent a new timer event. It first drains the
      // durable inbox, including an expired lease or retry that survived a
      // host/runner restart.
      this.scheduleResidentDelivery(app.id);
      this.states.set(app.id, {
        status: "running",
        lastStartedAt,
        lastReadyAt: new Date().toISOString(),
      });
    } catch (error) {
      this.markFailed(app.id, lastStartedAt, error);
      throw error;
    }
  };

  listActions = async ({
    app,
    manifest,
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
  }): Promise<ServiceAction[]> => {
    if (!app.enabled) return [];
    const runnerApp = await this.resolveRunnerApp(app, app.providerIds);
    const persistent =
      manifest.lifecycle?.mode === "resident" ||
      manifest.lifecycle?.mode === "provider";
    const lastStartedAt = persistent
      ? (this.states.get(app.id)?.lastStartedAt ?? new Date().toISOString())
      : new Date().toISOString();
    if (!persistent)
      this.states.set(app.id, { status: "starting", lastStartedAt });
    try {
      const actions = await this.runner.listActions(runnerApp);
      if (!persistent) {
        this.states.set(app.id, {
          status: "running",
          lastStartedAt,
          lastReadyAt: new Date().toISOString(),
        });
      }
      return actions.map((action) => {
        const declared = manifest.actions[action.name];
        return {
          id: buildServiceActionId(app.id, action.name),
          appId: app.id,
          name: action.name,
          title: declared?.title ?? action.title,
          description: declared?.description ?? action.description,
          inputSchema: declared?.inputSchema,
          risk: declared?.risk ?? DEFAULT_SERVICE_ACTION_RISK,
        };
      });
    } catch (error) {
      this.markFailed(app.id, lastStartedAt, error);
      await this.recoverPersistentComponentsIfNeeded(error);
      throw error;
    }
  };

  invokeAction = async ({
    app,
    manifest,
    actionName,
    input,
    job,
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
    actionName: string;
    input: Record<string, unknown>;
    job?: { jobId: string; eventSink: ServiceAppJobEventSink; callId?: string; traceId?: string };
  }): Promise<unknown> => {
    await this.start({ app, manifest });
    const runnerApp = await this.resolveRunnerApp(app, app.providerIds);
    if (manifest.lifecycle?.mode === "resident") {
      try {
        return await this.invokeRunnerAction(runnerApp, app, manifest, actionName, input, manifest.actions[actionName]?.timeoutMs ?? 7_000, job);
      } catch (error) {
        this.markFailed(
          app.id,
          this.states.get(app.id)?.lastStartedAt ?? new Date().toISOString(),
          error,
        );
        await this.recoverPersistentComponentsIfNeeded(error);
        throw error;
      }
    }
    const lastStartedAt = new Date().toISOString();
    this.states.set(app.id, { status: "starting", lastStartedAt });
    try {
      const result = await this.invokeRunnerAction(runnerApp, app, manifest, actionName, input, manifest.actions[actionName]?.timeoutMs ?? 7_000, job);
      this.states.set(app.id, {
        status: "running",
        lastStartedAt,
        lastReadyAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      this.markFailed(app.id, lastStartedAt, error);
      await this.recoverPersistentComponentsIfNeeded(error);
      throw error;
    }
  };

  cancelJob = async (params: { appId: string; instanceId: string; jobId: string }): Promise<void> => {
    if (!this.apps.has(params.appId)) return;
    const hostJob = this.activeHostJobs.get(params.jobId);
    if (hostJob) hostJob.terminalStatus = "cancelled";
    hostJob?.controller.abort();
    try {
      await this.runner.cancelJob(params.jobId);
    } catch (error) {
      // The runner has already returned after agent-start, but the enclosing
      // Job is still deliberately awaiting the Kernel-owned Agent result.
      if (!hostJob) throw error;
    }
  };

  /**
   * Single host ingress for scheduler/external events. The event is first
   * durable, then the Resident lane is woken; no caller can invoke a Resident
   * directly and skip dedupe, cursor, or retry semantics.
   */
  enqueueResidentEvent = async ({
    app,
    manifest,
    eventId,
    streamKey,
    payload,
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
    eventId: string;
    streamKey?: string;
    payload: Record<string, unknown>;
  }) => {
    if (manifest.lifecycle?.mode !== "resident") {
      throw new PortableServiceRunnerError(
        "SERVICE_APP_RUNTIME_FAILED",
        `Component ${app.id} is not a Resident.`,
      );
    }
    await this.start({ app, manifest });
    const event = await this.residentInbox.enqueue(requireResidentInboxScope(app), {
      eventId,
      streamKey,
      componentId: app.id,
      payload,
    });
    this.scheduleResidentDelivery(app.id);
    return event;
  };

  private invokeRunnerAction = async (
    app: PortableRunnerApp,
    record: ServiceAppRecord,
    manifest: ServiceAppManifest,
    actionName: string,
    input: Record<string, unknown>,
    timeoutMs: number,
    job?: { jobId: string; eventSink: ServiceAppJobEventSink; callId?: string; traceId?: string },
  ): Promise<unknown> => {
    if (!job) {
      const hostCall = this.createHostCallHandler(record, manifest);
      return await this.runner.invoke(app, actionName, input, timeoutMs, hostCall);
    }
    const hostJob: ActiveHostJob = {
      controller: new AbortController(),
      pendingTerminalWork: new Set<Promise<void>>(),
      deadlineAt: Date.now() + timeoutMs,
    };
    this.activeHostJobs.set(job.jobId, hostJob);
    const hostCall = this.createHostCallHandler(record, manifest, job, hostJob);
    let writes = Promise.resolve();
    let localTerminal = false;
    let runnerTerminal: Extract<PortableRunnerJobEvent, { kind: "job-terminal" }> | undefined;
    const append = (event: PortableRunnerJobEvent): void => {
      writes = writes.then(async () => {
        if (event.kind === "job-progress") {
          await job.eventSink.reportProgress({ current: event.current, total: event.total, message: event.message });
        } else if (event.kind === "stream-chunk") {
          await job.eventSink.emitChunk(event.content);
        } else if (event.kind === "job-terminal" && !localTerminal) {
          runnerTerminal = event;
        }
      }).catch(() => undefined);
    };
    try {
      const result = await this.runner.runJob(app, actionName, input, {
        jobId: job.jobId,
        timeoutMs,
        watch: append,
        hostCall,
        callId: job.callId,
        traceId: job.traceId,
      });
      await writes;
      await Promise.allSettled(hostJob.pendingTerminalWork);
      if (runnerTerminal && !localTerminal) {
        const status = hostJob.terminalStatus ?? runnerTerminal.status;
        await job.eventSink.recordTerminal({
          status,
          error: hostJob.terminalStatus === "timed-out"
            ? { code: "PORTABLE_RUNTIME_TIMEOUT", message: "Portable AI Agent call timed out." }
            : hostJob.terminalStatus === "cancelled"
              ? { code: "JOB_CANCELLED", message: "Portable AI Agent call was cancelled." }
              : runnerTerminal.error?.message
            ? { code: runnerTerminal.error.code, message: runnerTerminal.error.message }
            : undefined,
        }).catch(() => undefined);
      }
      return result;
    } catch (error) {
      localTerminal = true;
      await writes;
      const runnerError = error instanceof PortableServiceRunnerError ? error : undefined;
      await job.eventSink.recordTerminal({
        status: runnerError?.code === "PORTABLE_RUNTIME_TIMEOUT" ? "timed-out" : "failed",
        error: { code: runnerError?.code ?? "PORTABLE_RUNTIME_FAILED", message: error instanceof Error ? error.message : String(error) },
      }).catch(() => undefined);
      throw error;
    } finally {
      if (hostJob.timeout) clearTimeout(hostJob.timeout);
      this.activeHostJobs.delete(job.jobId);
    }
  };

  private createHostCallHandler = (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
    job?: { jobId: string; eventSink: ServiceAppJobEventSink; callId?: string; traceId?: string },
    hostJob?: ActiveHostJob,
  ): PortableRunnerHostCallHandler => async (request, signal) => {
    if (request.appId !== app.id) {
      throw new PortableServiceRunnerError(
        "HOST_CALL_APP_MISMATCH",
        "Portable host callback App identity did not match its active invocation.",
      );
    }
    const handler = this.hostCallHandler;
    if (!handler) {
      throw new PortableServiceRunnerError(
        "AI_CAPABILITY_UNAVAILABLE",
        "The NextClaw AI capability owner is unavailable for this portable invocation.",
      );
    }
    return await handler({
      app,
      manifest,
      request,
      signal,
      job,
      jobSignal: hostJob?.controller.signal,
      deferTerminal: hostJob
        ? (completion) => {
            hostJob.pendingTerminalWork.add(completion);
            const remainingMs = Math.max(0, hostJob.deadlineAt - Date.now());
            hostJob.timeout ??= setTimeout(() => {
              hostJob.terminalStatus = "timed-out";
              hostJob.controller.abort();
            }, remainingMs);
            hostJob.timeout.unref();
            void completion.finally(() => hostJob.pendingTerminalWork.delete(completion));
          }
        : undefined,
    });
  };

  stop = async (appId: string): Promise<void> => {
    const registration = this.persistentRegistrations.get(appId);
    if (registration?.manifest.lifecycle?.mode === "resident") {
      await this.residentInbox.freeze(requireResidentInboxScope(registration.app));
    }
    this.clearResidentTimer(appId);
    this.providers.delete(appId);
    this.persistentRegistrations.delete(appId);
    const app = this.apps.get(appId);
    this.apps.delete(appId);
    if (app) await this.runner.stop(app);
    this.states.set(appId, { status: "idle" });
  };

  restart = async (appId: string): Promise<void> => await this.stop(appId);

  dispose = async (): Promise<void> => {
    if (this.recoveryPromise) await this.recoveryPromise;
    for (const appId of this.residentTimers.keys())
      this.clearResidentTimer(appId);
    await Promise.allSettled(this.residentDeliveries.values());
    await this.runner.dispose();
    this.states.clear();
    this.apps.clear();
    this.providers.clear();
    this.persistentRegistrations.clear();
    this.residentDeliveries.clear();
  };

  private scheduleResidentEvent = (params: {
    appId: string;
    eventIntervalMs: number;
  }): void => {
    const registration = this.persistentRegistrations.get(params.appId);
    if (!registration || registration.manifest.lifecycle?.mode !== "resident") return;
    const triggeredAt = new Date().toISOString();
    void this.residentInbox.enqueue(requireResidentInboxScope(registration.app), {
      eventId: `timer-${triggeredAt}`,
      streamKey: "timer",
      componentId: registration.app.id,
      payload: {
        eventId: `timer-${triggeredAt}`,
        kind: "timer",
        triggeredAt,
        eventIntervalMs: params.eventIntervalMs,
      },
    }).then(() => this.scheduleResidentDelivery(params.appId)).catch((error) => {
      this.markFailed(
        params.appId,
        this.states.get(params.appId)?.lastStartedAt ?? triggeredAt,
        error,
      );
    });
  };

  private scheduleResidentDelivery = (appId: string): void => {
    if (this.residentDeliveries.has(appId)) return;
    const delivery = this.deliverNextResidentInboxEvent(appId).finally(() => {
      this.residentDeliveries.delete(appId);
    });
    this.residentDeliveries.set(appId, delivery);
  };

  private deliverNextResidentInboxEvent = async (appId: string): Promise<void> => {
    const registration = this.persistentRegistrations.get(appId);
    const app = this.apps.get(appId);
    if (!registration || !app || registration.manifest.lifecycle?.mode !== "resident") return;
    const scope = requireResidentInboxScope(registration.app);
    const leased = await this.residentInbox.leaseNext(scope);
    if (!leased) return;
    try {
      const raw = await this.runner.deliverEvent(app, leased.payload);
      const delivered = await this.residentInbox.applyDisposition(
        scope,
        leased.eventId,
        normalizeResidentDisposition(raw),
      );
      // Continue the single lane without waiting for the next scheduler tick.
      // A retry gets one bounded wakeup at its requested/backoff deadline;
      // acknowledgement wakes immediately so a later stream item can run.
      const delay = delivered.status === "retry-wait"
        ? Math.max(0, Date.parse(delivered.nextAttemptAt ?? new Date().toISOString()) - Date.now())
        : 0;
      const wake = setTimeout(() => this.scheduleResidentDelivery(appId), delay);
      wake.unref();
    } catch (error) {
      // A failed delivery is a retryable event fact, not a reason to discard
      // the whole Resident or advance its cursor. Only an actual runner exit
      // enters the existing persistent-role recovery path.
      await this.residentInbox.retry(scope, leased.eventId, {
        kind: "retry",
        error: {
          code: error instanceof PortableServiceRunnerError
            ? error.code
            : "RESIDENT_DELIVERY_FAILED",
          message: error instanceof Error ? error.message : "Resident delivery failed.",
        },
      });
      await this.recoverPersistentComponentsIfNeeded(error);
    }
  };

  private clearResidentTimer = (appId: string): void => {
    const timer = this.residentTimers.get(appId);
    if (timer) clearInterval(timer);
    this.residentTimers.delete(appId);
  };

  private recoverPersistentComponentsIfNeeded = async (
    error: unknown,
  ): Promise<void> => {
    if (
      !(error instanceof PortableServiceRunnerError) ||
      error.code !== "PORTABLE_RUNNER_EXITED"
    ) {
      return;
    }
    if (this.recoveryPromise) return await this.recoveryPromise;
    const registrations = Array.from(this.persistentRegistrations.values());
    if (registrations.length === 0) return;
    this.recoveryPromise = (async () => {
      for (const appId of this.residentTimers.keys())
        this.clearResidentTimer(appId);
      this.providers.clear();
      const ordered = [
        ...registrations.filter(
          ({ manifest }) => manifest.lifecycle?.mode === "provider",
        ),
        ...registrations.filter(
          ({ manifest }) => manifest.lifecycle?.mode === "resident",
        ),
      ];
      for (const registration of ordered) {
        try {
          await this.start(registration);
        } catch {
          // start() owns the failed state; continue restoring independent components.
        }
      }
    })().finally(() => {
      this.recoveryPromise = undefined;
    });
    await this.recoveryPromise;
  };

  private resolveRunnerApp = async (
    app: ServiceAppRecord,
    providerIds: string[] | undefined,
  ): Promise<PortableRunnerApp> => {
    const next = await this.capabilityResolver.resolveRunnerApp({
      app,
      providerIds,
      previous: this.apps.get(app.id),
      stopChangedLane: async (previous) => await this.stopForCapabilityChange(app.id, previous),
    });
    this.apps.set(app.id, next);
    return next;
  };

  private stopForCapabilityChange = async (
    appId: string,
    previous: PortableRunnerApp,
  ): Promise<void> => {
    const registration = this.persistentRegistrations.get(appId);
    if (registration?.manifest.lifecycle?.mode === "resident") {
      await this.residentInbox.freeze(requireResidentInboxScope(registration.app));
    }
    this.clearResidentTimer(appId);
    this.providers.delete(appId);
    this.persistentRegistrations.delete(appId);
    this.apps.delete(appId);
    await this.runner.stop(previous);
    this.states.set(appId, { status: "idle" });
  };

  private markFailed = (
    appId: string,
    lastStartedAt: string,
    error: unknown,
  ): void => {
    this.states.set(appId, {
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
      lastStartedAt,
      lastFailedAt: new Date().toISOString(),
    });
  };
}
