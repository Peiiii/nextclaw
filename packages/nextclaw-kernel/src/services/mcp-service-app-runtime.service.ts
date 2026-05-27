import type { Config } from "@nextclaw/core";
import { McpServerLifecycleManager } from "@nextclaw/mcp";
import type { McpServerRecord, McpToolCatalogEntry } from "@nextclaw/mcp";
import type {
  ServiceAction,
  ServiceAppManifest,
  ServiceAppRecord,
  ServiceAppRuntimeStatus,
} from "@kernel/types/service-app.types.js";
import {
  buildServiceActionId,
  DEFAULT_SERVICE_ACTION_RISK,
} from "@kernel/utils/service-action.utils.js";

type RuntimeState = {
  status: ServiceAppRuntimeStatus;
  lastError?: string;
  lastReadyAt?: string;
};

export class McpServiceAppRuntimeService {
  private readonly lifecycleManager: McpServerLifecycleManager;
  private readonly states = new Map<string, RuntimeState>();

  constructor(private readonly params: { getConfig: () => Config }) {
    this.lifecycleManager = new McpServerLifecycleManager({
      getConfig: params.getConfig,
    });
  }

  getStatus = (appId: string): RuntimeState => {
    return this.states.get(appId) ?? { status: "idle" };
  };

  listActions = async ({
    app,
    manifest,
  }: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
  }): Promise<ServiceAction[]> => {
    if (!app.enabled) {
      return [];
    }
    this.states.set(app.id, { status: "starting" });
    try {
      const state = await this.lifecycleManager.warmServer(
        this.toMcpServerRecord(app, manifest),
      );
      this.states.set(app.id, {
        status: "running",
        lastReadyAt: state.lastReadyAt,
      });
      return state.tools.map((tool) => this.toServiceAction(manifest, tool));
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      this.states.set(app.id, {
        status: "failed",
        lastError,
      });
      return [];
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
    this.states.set(app.id, { status: "starting" });
    try {
      const result = await this.lifecycleManager.callTool(
        this.toMcpServerRecord(app, manifest),
        actionName,
        input,
      );
      this.states.set(app.id, {
        status: "running",
        lastReadyAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      this.states.set(app.id, {
        status: "failed",
        lastError,
      });
      throw error;
    }
  };

  restart = async (appId: string): Promise<void> => {
    await this.lifecycleManager.closeServer(appId);
    this.states.set(appId, { status: "idle" });
  };

  dispose = async (): Promise<void> => {
    await this.lifecycleManager.closeAll();
    this.states.clear();
  };

  private toMcpServerRecord = (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
  ): McpServerRecord => ({
    name: app.id,
    definition: {
      enabled: manifest.enabled,
      transport: {
        type: "stdio",
        command: manifest.command,
        args: manifest.args,
        cwd: app.dirPath,
        env: {},
        stderr: "pipe",
      },
      scope: {
        allAgents: false,
        agents: [],
      },
      policy: {
        trust: "explicit",
        start: "eager",
      },
    },
  });

  private toServiceAction = (
    manifest: ServiceAppManifest,
    tool: McpToolCatalogEntry,
  ): ServiceAction => {
    const actionId = buildServiceActionId(manifest.id, tool.toolName);
    const manifestAction = manifest.actions[tool.toolName];
    const risk = manifestAction?.risk ?? DEFAULT_SERVICE_ACTION_RISK;
    return {
      id: actionId,
      appId: manifest.id,
      name: tool.toolName,
      title: manifestAction?.title ?? tool.toolName,
      description: manifestAction?.description ?? tool.description,
      inputSchema: tool.parameters,
      risk,
    };
  };
}
