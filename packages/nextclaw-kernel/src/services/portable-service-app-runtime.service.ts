import type {
  ServiceAction,
  ServiceAppManifest,
  ServiceAppRecord,
  ServiceAppRuntimeStatus,
} from "@kernel/types/service-app.types.js";
import {
  PortableServiceRunnerError,
  PortableServiceRunnerClientService,
  type PortableRunnerApp,
} from "@kernel/services/portable-service-runner-client.service.js";
import {
  buildServiceActionId,
  DEFAULT_SERVICE_ACTION_RISK,
} from "@kernel/utils/service-action.utils.js";

type RuntimeState = {
  status: ServiceAppRuntimeStatus;
  lastError?: string;
  lastStartedAt?: string;
  lastReadyAt?: string;
  lastFailedAt?: string;
};

type PersistentRegistration = {
  app: ServiceAppRecord;
  manifest: ServiceAppManifest;
};

export class PortableServiceAppRuntimeService {
  private readonly runner: PortableServiceRunnerClientService;
  private readonly states = new Map<string, RuntimeState>();
  private readonly apps = new Map<string, PortableRunnerApp>();
  private readonly providers = new Set<string>();
  private readonly persistentRegistrations = new Map<string, PersistentRegistration>();
  private readonly residentTimers = new Map<string, NodeJS.Timeout>();
  private readonly residentDeliveries = new Map<string, Promise<void>>();
  private recoveryPromise?: Promise<void>;

  constructor(params: { runnerPath?: string } = {}) {
    this.runner = new PortableServiceRunnerClientService({
      runnerPath: params.runnerPath,
      onUnexpectedExit: (error) => {
        void this.recoverPersistentComponentsIfNeeded(error);
      },
    });
  }

  getStatus = (appId: string): RuntimeState => this.states.get(appId) ?? { status: "idle" };

  start = async ({
    app,
    manifest,
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
  }): Promise<void> => {
    if (!app.enabled || !manifest.lifecycle || manifest.lifecycle.mode === "action") return;
    this.persistentRegistrations.set(app.id, { app, manifest });
    const runnerApp = this.toRunnerApp(app, manifest.providerIds);
    this.apps.set(app.id, runnerApp);
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
      const timer = setInterval(() => {
        this.scheduleResidentEvent({
          appId: app.id,
          eventIntervalMs: manifest.lifecycle?.mode === "resident"
            ? manifest.lifecycle.eventIntervalMs
            : 0,
        });
      }, manifest.lifecycle.eventIntervalMs);
      timer.unref();
      this.residentTimers.set(app.id, timer);
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
    const runnerApp = this.toRunnerApp(app, manifest.providerIds);
    this.apps.set(app.id, runnerApp);
    const persistent = manifest.lifecycle?.mode === "resident"
      || manifest.lifecycle?.mode === "provider";
    const lastStartedAt = persistent
      ? this.states.get(app.id)?.lastStartedAt ?? new Date().toISOString()
      : new Date().toISOString();
    if (!persistent) this.states.set(app.id, { status: "starting", lastStartedAt });
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
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
    actionName: string;
    input: Record<string, unknown>;
  }): Promise<unknown> => {
    await this.start({ app, manifest });
    const runnerApp = this.toRunnerApp(app, manifest.providerIds);
    this.apps.set(app.id, runnerApp);
    if (manifest.lifecycle?.mode === "resident") {
      try {
        return await this.runner.invoke(
          runnerApp,
          actionName,
          input,
          manifest.actions[actionName]?.timeoutMs ?? 7_000,
        );
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
      const result = await this.runner.invoke(
        runnerApp,
        actionName,
        input,
        manifest.actions[actionName]?.timeoutMs ?? 7_000,
      );
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

  stop = async (appId: string): Promise<void> => {
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
    for (const appId of this.residentTimers.keys()) this.clearResidentTimer(appId);
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
    if (this.residentDeliveries.has(params.appId)) return;
    const delivery = this.deliverResidentEvent(params).finally(() => {
      this.residentDeliveries.delete(params.appId);
    });
    this.residentDeliveries.set(params.appId, delivery);
  };

  private deliverResidentEvent = async (params: {
    appId: string;
    eventIntervalMs: number;
  }): Promise<void> => {
    const app = this.apps.get(params.appId);
    if (!app) return;
    const triggeredAt = new Date().toISOString();
    try {
      await this.runner.deliverEvent(app, {
        eventId: `timer-${triggeredAt}`,
        kind: "timer",
        triggeredAt,
        eventIntervalMs: params.eventIntervalMs,
      });
    } catch (error) {
      this.clearResidentTimer(params.appId);
      this.markFailed(
        params.appId,
        this.states.get(params.appId)?.lastStartedAt ?? triggeredAt,
        error,
      );
      await this.recoverPersistentComponentsIfNeeded(error);
    }
  };

  private clearResidentTimer = (appId: string): void => {
    const timer = this.residentTimers.get(appId);
    if (timer) clearInterval(timer);
    this.residentTimers.delete(appId);
  };

  private recoverPersistentComponentsIfNeeded = async (error: unknown): Promise<void> => {
    if (!(error instanceof PortableServiceRunnerError)
      || !["PORTABLE_RUNTIME_TIMEOUT", "PORTABLE_RUNNER_EXITED"].includes(error.code)) {
      return;
    }
    if (this.recoveryPromise) return await this.recoveryPromise;
    const registrations = Array.from(this.persistentRegistrations.values());
    if (registrations.length === 0) return;
    this.recoveryPromise = (async () => {
      for (const appId of this.residentTimers.keys()) this.clearResidentTimer(appId);
      this.providers.clear();
      const ordered = [
        ...registrations.filter(({ manifest }) => manifest.lifecycle?.mode === "provider"),
        ...registrations.filter(({ manifest }) => manifest.lifecycle?.mode === "resident"),
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

  private toRunnerApp = (
    app: ServiceAppRecord,
    providerIds: string[] | undefined,
  ): PortableRunnerApp => {
    if (!app.componentPath || !app.dataDirectory) {
      throw new Error(`Portable Service App ${app.id} is missing component or data storage.`);
    }
    return {
      id: app.id,
      componentPath: app.componentPath,
      dataDirectory: app.dataDirectory,
      permissions: app.permissions ?? {},
      providerIds,
    };
  };

  private markFailed = (appId: string, lastStartedAt: string, error: unknown): void => {
    this.states.set(appId, {
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
      lastStartedAt,
      lastFailedAt: new Date().toISOString(),
    });
  };
}
