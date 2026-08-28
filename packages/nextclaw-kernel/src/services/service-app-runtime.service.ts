import type { Config } from "@nextclaw/core";
import { McpServiceAppRuntimeService } from "@kernel/services/mcp-service-app-runtime.service.js";
import { PortableServiceAppRuntimeService } from "@kernel/services/portable-service-app-runtime.service.js";
import type {
  ServiceAppManifest,
  ServiceAppProtocol,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";

type RuntimeCall = { app: ServiceAppRecord; manifest: ServiceAppManifest };

export class ServiceAppRuntimeService {
  private readonly mcp: McpServiceAppRuntimeService;
  private readonly portable: PortableServiceAppRuntimeService;
  private readonly protocols = new Map<string, ServiceAppProtocol>();

  constructor(params: { getConfig: () => Config; portableServiceRunnerPath?: string }) {
    this.mcp = new McpServiceAppRuntimeService(params);
    this.portable = new PortableServiceAppRuntimeService({
      runnerPath: params.portableServiceRunnerPath,
    });
  }

  getStatus = (appId: string) => {
    const protocol = this.protocols.get(appId);
    return protocol === "wasi-component"
      ? this.portable.getStatus(appId)
      : this.mcp.getStatus(appId);
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

  invokeAction = async (call: RuntimeCall & {
    actionName: string;
    input: Record<string, unknown>;
  }) => {
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

  dispose = async (): Promise<void> => {
    await Promise.all([this.mcp.dispose(), this.portable.dispose()]);
    this.protocols.clear();
  };
}
