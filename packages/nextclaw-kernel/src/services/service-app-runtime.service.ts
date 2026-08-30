import type { Config } from "@nextclaw/core";
import { McpServiceAppRuntimeService } from "@kernel/services/mcp-service-app-runtime.service.js";
import {
  PortableServiceAppRuntimeService,
  type PortableServiceAppHostCallHandler,
} from "@kernel/services/portable-service-app-runtime.service.js";
import type {
  ServiceAppManifest,
  ServiceAppProtocol,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import type { ServiceAppJobEventSink } from "@kernel/services/service-app-job-journal.service.js";
import type { ServiceAppResidentEventInboxService } from "@kernel/services/service-app-resident-event-inbox.service.js";

type RuntimeCall = { app: ServiceAppRecord; manifest: ServiceAppManifest };

export class ServiceAppRuntimeService {
  private readonly mcp: McpServiceAppRuntimeService;
  private readonly portable: PortableServiceAppRuntimeService;
  private readonly protocols = new Map<string, ServiceAppProtocol>();

  constructor(params: {
    getConfig: () => Config;
    configPath?: string;
    appHomeDirectory?: string;
    portableServiceRunnerPath?: string;
    residentInbox?: ServiceAppResidentEventInboxService;
  }) {
    const { appHomeDirectory, portableServiceRunnerPath, getConfig, configPath, residentInbox } = params;
    this.mcp = new McpServiceAppRuntimeService(params);
    this.portable = new PortableServiceAppRuntimeService({
      appHomeDirectory,
      runnerPath: portableServiceRunnerPath,
      getSecretConfig: getConfig,
      secretConfigPath: configPath,
      residentInbox,
    });
  }

  getStatus = (appId: string) => {
    const protocol = this.protocols.get(appId);
    return protocol === "wasi-component"
      ? this.portable.getStatus(appId)
      : this.mcp.getStatus(appId);
  };

  getLastObservation = () => this.portable.getLastObservation();

  /** One kernel-owned callback path for Guest host calls; MCP never receives it. */
  setPortableHostCallHandler = (handler: PortableServiceAppHostCallHandler | undefined): void => {
    this.portable.setHostCallHandler(handler);
  };

  start = async (call: RuntimeCall): Promise<void> => {
    this.protocols.set(call.app.id, call.manifest.protocol);
    if (call.manifest.protocol === "wasi-component") {
      await this.portable.start(call);
    }
  };

  listActions = async (call: RuntimeCall) => {
    this.protocols.set(call.app.id, call.manifest.protocol);
    return call.manifest.protocol === "wasi-component"
      ? await this.portable.listActions(call)
      : await this.mcp.listActions(call);
  };

  invokeAction = async (
    call: RuntimeCall & {
      actionName: string;
      input: Record<string, unknown>;
      job?: { jobId: string; eventSink: ServiceAppJobEventSink; callId?: string; traceId?: string };
    },
  ) => {
    this.protocols.set(call.app.id, call.manifest.protocol);
    return call.manifest.protocol === "wasi-component"
      ? await this.portable.invokeAction(call)
      : await this.mcp.invokeAction(call);
  };

  stop = async (appId: string): Promise<void> => {
    const protocol = this.protocols.get(appId);
    if (protocol === "wasi-component") {
      await this.portable.stop(appId);
    } else if (protocol === "mcp") {
      await this.mcp.stop(appId);
    } else {
      await Promise.all([this.mcp.stop(appId), this.portable.stop(appId)]);
    }
  };

  restart = async (appId: string): Promise<void> => await this.stop(appId);

  cancelJob = async (params: { appId: string; instanceId: string; jobId: string }): Promise<void> => {
    await this.portable.cancelJob(params);
  };

  enqueueResidentEvent = async (call: RuntimeCall & {
    eventId: string;
    streamKey?: string;
    payload: Record<string, unknown>;
  }) => {
    this.protocols.set(call.app.id, call.manifest.protocol);
    if (call.manifest.protocol !== "wasi-component") {
      throw new Error(`Resident durable inbox is not supported for ${call.manifest.protocol}.`);
    }
    return await this.portable.enqueueResidentEvent(call);
  };

  dispose = async (): Promise<void> => {
    await Promise.all([this.mcp.dispose(), this.portable.dispose()]);
    this.protocols.clear();
  };
}
