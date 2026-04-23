import { getDataDir } from "@nextclaw/core";
import {
  startPluginChannelGateways,
  stopPluginChannelGateways,
  type PluginChannelGatewayHandle,
  type PluginRegistry,
} from "@nextclaw/openclaw-compat";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { type NcpEndpointEvent } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager, type RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { join } from "node:path";
import { loadPluginRegistryProgressively } from "@/cli/commands/plugin/plugin-registry-loader.js";
import {
  createExtensionHostRegistrationId,
  ExtensionHostSnapshotService,
  normalizeExtensionHostToolList,
  pickExtensionHostToolForAlias,
} from "@/cli/shared/services/extension-host-snapshot.service.js";
import type {
  ExtensionHostChannelOutboundRequest,
  ExtensionHostLoadRequest,
  ExtensionHostMessage,
  ExtensionHostRuntimeDescribeRequest,
  ExtensionHostRuntimeRunRequest,
  ExtensionHostSnapshot,
  ExtensionHostStartGatewaysRequest,
  ExtensionHostToolExecuteRequest,
} from "@/cli/shared/types/extension-host.types.js";

type ChildProcessWithIpc = NodeJS.Process & {
  send?: (message: ExtensionHostMessage) => boolean;
};

const childProcess = process as ChildProcessWithIpc;

function send(message: ExtensionHostMessage): void {
  if (!childProcess.connected) {
    return;
  }
  try {
    childProcess.send?.(message);
  } catch (error) {
    if ((error as { code?: unknown }).code === "EPIPE") {
      process.exit(0);
    }
    throw error;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class ExtensionHostChildRuntime {
  private pluginRegistry: PluginRegistry | null = null;
  private pluginGatewayHandles: PluginChannelGatewayHandle[] = [];
  private readonly runtimeAbortControllers = new Map<string, AbortController>();
  private readonly assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  private readonly snapshotService = new ExtensionHostSnapshotService();

  handleMessage = (message: ExtensionHostMessage): void => {
    if (message.type !== "request") {
      return;
    }
    void this.handleRequest(message);
  };

  private handleRequest = async (message: Extract<ExtensionHostMessage, { type: "request" }>): Promise<void> => {
    try {
      const payload = await this.dispatchRequest(message);
      send({ type: "response", id: message.id, ok: true, payload });
    } catch (error) {
      send({
        type: "response",
        id: message.id,
        ok: false,
        error: toErrorMessage(error),
      });
    }
  };

  private dispatchRequest = async (
    message: Extract<ExtensionHostMessage, { type: "request" }>,
  ): Promise<unknown> => {
    if (message.method === "load") {
      return await this.load(message.payload);
    }
    if (message.method === "tool.execute") {
      return await this.executeTool(message.payload);
    }
    if (message.method === "channel.startGateways") {
      return await this.startGateways(message.payload);
    }
    if (message.method === "channel.stopGateways") {
      await this.stopGateways();
      return undefined;
    }
    if (message.method === "channel.outbound") {
      return await this.sendChannelOutbound(message.payload);
    }
    if (message.method === "runtime.describe") {
      return await this.describeRuntime(message.payload);
    }
    if (message.method === "runtime.run") {
      this.startRuntimeRun(message.payload);
      return undefined;
    }
    if (message.method === "runtime.abort") {
      this.runtimeAbortControllers.get(message.payload.streamId)?.abort(message.payload.reason);
      return undefined;
    }
    throw new Error(`Unsupported extension host request: ${String((message as { method?: unknown }).method)}`);
  };

  private load = async (request: ExtensionHostLoadRequest): Promise<ExtensionHostSnapshot> => {
    const totalPluginCount = Object.values(request.config.plugins.entries ?? {})
      .filter((entry) => entry?.enabled !== false).length;
    const registry = await loadPluginRegistryProgressively(request.config, request.workspaceDir, {
      onPluginProcessed: ({ loadedPluginCount, pluginId }) => {
        send({
          type: "event",
          event: "load.progress",
          payload: {
            loadedPluginCount,
            totalPluginCount,
            ...(pluginId ? { pluginId } : {}),
          },
        });
      },
    });
    this.pluginRegistry = registry;
    return this.snapshotService.createSnapshot(registry, request);
  };

  private executeTool = async (request: ExtensionHostToolExecuteRequest): Promise<unknown> => {
    const registry = this.requireRegistry();
    const registration = registry.tools.find((tool, index) =>
      createExtensionHostRegistrationId({
        kind: "tool",
        pluginId: tool.pluginId,
        source: tool.source,
        index,
      }) === request.registrationId
    );
    if (!registration) {
      throw new Error(`Plugin tool registration not found: ${request.registrationId}`);
    }
    const tool = pickExtensionHostToolForAlias({
      tools: normalizeExtensionHostToolList(registration.factory(request.context)),
      alias: request.alias,
      declaredNames: registration.names,
    });
    if (!tool) {
      throw new Error(`Plugin tool '${request.alias}' is not available`);
    }
    if (tool.execute.length >= 2) {
      return await (tool.execute as (toolCallId: string, params: Record<string, unknown>) => Promise<unknown> | unknown)(
        request.toolCallId ?? "",
        request.params,
      );
    }
    return await (tool.execute as (params: Record<string, unknown>) => Promise<unknown> | unknown)(request.params);
  };

  private startGateways = async (request: ExtensionHostStartGatewaysRequest): Promise<{
    diagnostics: ExtensionHostSnapshot["diagnostics"];
  }> => {
    await this.stopGateways();
    const result = await startPluginChannelGateways({
      registry: this.requireRegistry(),
      config: request.config,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
        debug: (message) => console.debug(message),
      },
    });
    this.pluginGatewayHandles = result.handles;
    return { diagnostics: result.diagnostics };
  };

  private stopGateways = async (): Promise<void> => {
    await stopPluginChannelGateways(this.pluginGatewayHandles);
    this.pluginGatewayHandles = [];
  };

  private sendChannelOutbound = async (request: ExtensionHostChannelOutboundRequest): Promise<unknown> => {
    const registration = this.requireRegistry().channels.find(
      (entry) => entry.pluginId === request.pluginId && entry.channel.id === request.channelId,
    );
    if (!registration) {
      throw new Error(`Plugin channel not found: ${request.pluginId}/${request.channelId}`);
    }
    if (request.kind === "payload") {
      if (!registration.channel.outbound?.sendPayload) {
        throw new Error(`Plugin channel '${request.channelId}' has no payload outbound handler`);
      }
      return await registration.channel.outbound.sendPayload({
        cfg: request.cfg,
        to: request.to,
        text: request.text,
        payload: request.payload,
        accountId: request.accountId,
      });
    }
    if (!registration.channel.outbound?.sendText) {
      throw new Error(`Plugin channel '${request.channelId}' has no text outbound handler`);
    }
    return await registration.channel.outbound.sendText({
      cfg: request.cfg,
      to: request.to,
      text: request.text,
      accountId: request.accountId,
    });
  };

  private describeRuntime = async (request: ExtensionHostRuntimeDescribeRequest): Promise<unknown> => {
    const registration = this.findRuntime(request.kind);
    if (request.entry && registration.describeSessionTypeForEntry) {
      return await registration.describeSessionTypeForEntry({
        entry: request.entry,
        describeParams: request.describeParams,
      });
    }
    return await registration.describeSessionType?.(request.describeParams);
  };

  private startRuntimeRun = (request: ExtensionHostRuntimeRunRequest): void => {
    const abortController = new AbortController();
    this.runtimeAbortControllers.set(request.streamId, abortController);
    void this.runRuntime(request, abortController).finally(() => {
      this.runtimeAbortControllers.delete(request.streamId);
    });
  };

  private runRuntime = async (
    request: ExtensionHostRuntimeRunRequest,
    abortController: AbortController,
  ): Promise<void> => {
    try {
      const registration = this.findRuntime(request.kind);
      const stateManager = createMirroredStateManager({
        dispatchBatchToParent: (events) => {
          send({
            type: "event",
            event: "runtime.state.dispatchBatch",
            payload: {
              streamId: request.streamId,
              events,
            },
          });
        },
      });
      stateManager.hydrate({
        sessionId: request.input.sessionId,
        messages: request.input.messages,
      });
      const runtimeParams = {
        ...request.runtimeParams,
        stateManager,
        resolveAssetContentPath: (assetUri: string) => this.assetStore.resolveContentPath(assetUri),
        resolveTools: request.runtimeParams.resolvedTools
          ? () => request.runtimeParams.resolvedTools
          : undefined,
        setSessionMetadata: (metadata: Record<string, unknown>) => {
          send({
            type: "event",
            event: "runtime.metadata",
            payload: {
              streamId: request.streamId,
              metadata,
            },
          });
        },
      };
      const runtime = request.entry && registration.createRuntimeForEntry
        ? registration.createRuntimeForEntry({
            entry: request.entry,
            runtimeParams: {
              ...runtimeParams,
              sessionMetadata: {
                ...runtimeParams.sessionMetadata,
                runtime_type: request.entry.type,
              },
            },
          })
        : registration.createRuntime(runtimeParams);
      for await (const event of runtime.run(request.input, { signal: abortController.signal })) {
        send({
          type: "event",
          event: "runtime.event",
          payload: {
            streamId: request.streamId,
            event,
          },
        });
      }
      send({ type: "event", event: "runtime.done", payload: { streamId: request.streamId } });
    } catch (error) {
      send({
        type: "event",
        event: "runtime.error",
        payload: {
          streamId: request.streamId,
          error: toErrorMessage(error),
        },
      });
    }
  };

  private findRuntime = (kind: string): NonNullable<PluginRegistry["ncpAgentRuntimes"][number]> => {
    const registration = this.requireRegistry().ncpAgentRuntimes.find((entry) => entry.kind === kind);
    if (!registration) {
      throw new Error(`Plugin NCP runtime not found: ${kind}`);
    }
    return registration;
  };

  private requireRegistry = (): PluginRegistry => {
    if (!this.pluginRegistry) {
      throw new Error("Extension host plugin registry is not loaded");
    }
    return this.pluginRegistry;
  };
}

function createMirroredStateManager(params: {
  dispatchBatchToParent: (events: NcpEndpointEvent[]) => void;
}): RuntimeFactoryParams["stateManager"] {
  const local = new DefaultNcpAgentConversationStateManager();
  return {
    getSnapshot: () => local.getSnapshot(),
    subscribe: (listener: Parameters<DefaultNcpAgentConversationStateManager["subscribe"]>[0]) =>
      local.subscribe(listener),
    reset: () => local.reset(),
    hydrate: (payload: Parameters<DefaultNcpAgentConversationStateManager["hydrate"]>[0]) => local.hydrate(payload),
    dispatch: async (event: NcpEndpointEvent) => {
      await local.dispatchBatch([event]);
      params.dispatchBatchToParent([event]);
    },
    dispatchBatch: async (events: readonly NcpEndpointEvent[]) => {
      const normalized = [...events];
      await local.dispatchBatch(normalized);
      params.dispatchBatchToParent(normalized);
    },
  } as unknown as RuntimeFactoryParams["stateManager"];
}

const runtime = new ExtensionHostChildRuntime();
process.on("message", runtime.handleMessage);
process.on("disconnect", () => {
  process.exit(0);
});
process.on("error", (error) => {
  if ((error as { code?: unknown }).code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});
