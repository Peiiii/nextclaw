import type { Config } from "@nextclaw/core";
import {
  createRuntimeChildEnv,
  resolveRuntimeCommandLaunch,
} from "@nextclaw/core";
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
  lastStartedAt?: string;
  lastReadyAt?: string;
  lastFailedAt?: string;
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
    const lastStartedAt = new Date().toISOString();
    this.states.set(app.id, { status: "starting", lastStartedAt });
    try {
      const state = await this.lifecycleManager.warmServer(
        this.toMcpServerRecord(app, manifest),
      );
      this.states.set(app.id, {
        status: "running",
        lastStartedAt,
        lastReadyAt: state.lastReadyAt,
      });
      return state.tools.map((tool) => this.toServiceAction(manifest, tool));
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      this.states.set(app.id, {
        status: "failed",
        lastError,
        lastStartedAt,
        lastFailedAt: new Date().toISOString(),
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
    const lastStartedAt = new Date().toISOString();
    this.states.set(app.id, { status: "starting", lastStartedAt });
    try {
      const result = await this.lifecycleManager.callTool(
        this.toMcpServerRecord(app, manifest),
        actionName,
        input,
      );
      this.states.set(app.id, {
        status: "running",
        lastStartedAt,
        lastReadyAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      this.states.set(app.id, {
        status: "failed",
        lastError,
        lastStartedAt,
        lastFailedAt: new Date().toISOString(),
      });
      throw error;
    }
  };

  stop = async (appId: string): Promise<void> => {
    await this.lifecycleManager.closeServer(appId);
    this.states.set(appId, { status: "idle" });
  };

  restart = async (appId: string): Promise<void> => {
    await this.stop(appId);
  };

  dispose = async (): Promise<void> => {
    await this.lifecycleManager.closeAll();
    this.states.clear();
  };

  private toMcpServerRecord = (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
  ): McpServerRecord => {
    if (!manifest.command || !manifest.args) {
      throw new Error(`MCP Service App ${app.id} is missing its launch command.`);
    }
    const launch = resolveRuntimeCommandLaunch(manifest.command);
    return {
      name: app.id,
      definition: {
        enabled: app.enabled,
        transport: {
          type: "stdio",
          command: launch.command,
          args: manifest.args,
          cwd: app.dirPath,
          env: createRuntimeChildEnv(process.env, {
            ...this.createAppRuntimeEnv(app),
            ...launch.envPatch,
          }),
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
    };
  };

  private createAppRuntimeEnv = (app: ServiceAppRecord): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = {};
    if (app.storage) {
      env.NEXTCLAW_APP_INSTANCE_ID = app.storage.instanceId;
      env.NEXTCLAW_APP_COMPONENT_ID = app.id;
      env.NEXTCLAW_APP_DATA_DIR = app.storage.dataDirectory;
      env.NEXTCLAW_APP_CONFIG_DIR = app.storage.configDirectory;
      env.NEXTCLAW_APP_STATE_DIR = app.storage.stateDirectory;
      env.NEXTCLAW_APP_CACHE_DIR = app.storage.cacheDirectory;
      env.NEXTCLAW_APP_TMP_DIR = app.storage.temporaryDirectory;
      env.NEXTCLAW_APP_LOG_DIR = app.storage.logsDirectory;
    } else if (app.dataDirectory) {
      env.NEXTCLAW_APP_DATA_DIR = app.dataDirectory;
    }
    if (
      app.sourceKind !== "package" ||
      !app.packageId ||
      !app.packageVersion ||
      !app.packageDirectory
    ) {
      return env;
    }
    env.NEXTCLAW_APP_ID = app.packageId;
    env.NEXTCLAW_APP_VERSION = app.packageVersion;
    env.NEXTCLAW_APP_PACKAGE_DIR = app.packageDirectory;
    return env;
  };

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
