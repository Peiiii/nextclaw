import type { Config } from "@nextclaw/core";
import type { NcpAgentRunInput, NcpAgentRunOptions, NcpAgentRuntime, NcpEndpointEvent } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type {
  OpenClawPluginTool,
  OpenClawPluginToolContext,
  PluginRegistry,
} from "@nextclaw/openclaw-compat";
import type {
  ExtensionHostChannelOutboundRequest,
  ExtensionHostRuntimeDescribeRequest,
  ExtensionHostSnapshot,
  ExtensionHostToolDescriptor,
  ExtensionHostToolExecuteRequest,
} from "@/cli/shared/types/extension-host.types.js";

export type ExtensionHostProxyClient = {
  executeTool: (request: ExtensionHostToolExecuteRequest) => Promise<unknown>;
  sendChannelOutbound: (request: ExtensionHostChannelOutboundRequest) => Promise<unknown>;
  describeRuntime: (request: ExtensionHostRuntimeDescribeRequest) => Promise<unknown>;
  runRuntimeStream: (params: {
    kind: string;
    entry?: ExtensionHostRuntimeDescribeRequest["entry"];
    runtimeParams: RuntimeFactoryParams;
    input: NcpAgentRunInput;
    signal?: AbortSignal;
  }) => AsyncIterable<NcpEndpointEvent>;
};

function normalizeSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      type: "object",
      properties: {},
      additionalProperties: true,
    };
  }
  return schema as Record<string, unknown>;
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickPreview(params: {
  descriptor: ExtensionHostToolDescriptor;
  alias: string;
}): ExtensionHostToolDescriptor["previews"][number] | null {
  const { alias, descriptor } = params;
  const byName = descriptor.previews.find((preview) => preview.name === alias);
  if (byName) {
    return byName;
  }
  if (descriptor.previews.length === 1) {
    return descriptor.previews[0] ?? null;
  }
  if (descriptor.previews.length === descriptor.names.length) {
    const index = descriptor.names.indexOf(alias);
    if (index >= 0 && index < descriptor.previews.length) {
      return descriptor.previews[index] ?? null;
    }
  }
  return null;
}

class ExtensionHostProxyRuntime implements NcpAgentRuntime {
  constructor(
    private readonly params: {
      client: ExtensionHostProxyClient;
      kind: string;
      entry?: ExtensionHostRuntimeDescribeRequest["entry"];
      runtimeParams: RuntimeFactoryParams;
    },
  ) {}

  run = (
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncIterable<NcpEndpointEvent> =>
    this.params.client.runRuntimeStream({
      kind: this.params.kind,
      entry: this.params.entry,
      runtimeParams: this.params.runtimeParams,
      input,
      signal: options?.signal,
    });
}

export class ExtensionHostProxyRegistryService {
  constructor(private readonly client: ExtensionHostProxyClient) {}

  createPluginRegistry = (snapshot: ExtensionHostSnapshot): PluginRegistry => ({
    plugins: snapshot.plugins,
    diagnostics: snapshot.diagnostics,
    tools: snapshot.tools.map((descriptor) => ({
      pluginId: descriptor.pluginId,
      source: descriptor.source,
      names: descriptor.names,
      optional: descriptor.optional,
      factory: (context) => this.createProxyTools(descriptor, context),
    })),
    channels: snapshot.channels.map((descriptor) => ({
      pluginId: descriptor.pluginId,
      source: descriptor.source,
      channel: {
        id: descriptor.channel.id,
        ...(descriptor.channel.meta ? { meta: descriptor.channel.meta } : {}),
        ...(descriptor.channel.capabilities ? { capabilities: descriptor.channel.capabilities } : {}),
        ...(descriptor.channel.configSchema ? { configSchema: descriptor.channel.configSchema } : {}),
        outbound: this.createChannelOutbound(descriptor),
      },
    })),
    providers: snapshot.providers.map((descriptor) => ({
      pluginId: descriptor.pluginId,
      source: descriptor.source,
      provider: descriptor.provider,
    })),
    ncpAgentRuntimes: snapshot.ncpAgentRuntimes.map((descriptor) => ({
      pluginId: descriptor.pluginId,
      source: descriptor.source,
      kind: descriptor.kind,
      label: descriptor.label,
      createRuntime: (runtimeParams) =>
        new ExtensionHostProxyRuntime({
          client: this.client,
          kind: descriptor.kind,
          runtimeParams,
        }),
      createRuntimeForEntry: descriptor.supportsEntryRuntime
        ? ({ entry, runtimeParams }) =>
            new ExtensionHostProxyRuntime({
              client: this.client,
              kind: descriptor.kind,
              entry,
              runtimeParams,
            })
        : undefined,
      describeSessionType: async (describeParams) =>
        await this.client.describeRuntime({
          kind: descriptor.kind,
          describeParams,
        }) as Awaited<ReturnType<NonNullable<PluginRegistry["ncpAgentRuntimes"][number]["describeSessionType"]>>>,
      describeSessionTypeForEntry: descriptor.supportsEntryDescription
        ? async ({ entry, describeParams }) =>
            await this.client.describeRuntime({
              kind: descriptor.kind,
              entry,
              describeParams,
            }) as Awaited<ReturnType<NonNullable<PluginRegistry["ncpAgentRuntimes"][number]["describeSessionTypeForEntry"]>>>
        : undefined,
    })),
    resolvedTools: snapshot.tools.flatMap((descriptor) =>
      descriptor.previews.map((preview) => this.createProxyTool(descriptor, preview.name, {}, preview)),
    ),
  });

  private createChannelOutbound = (
    descriptor: ExtensionHostSnapshot["channels"][number],
  ): NonNullable<PluginRegistry["channels"][number]["channel"]["outbound"]> => ({
    ...(descriptor.channel.hasOutboundText
      ? {
          sendText: async (ctx) =>
            await this.client.sendChannelOutbound({
              pluginId: descriptor.pluginId,
              channelId: descriptor.channel.id,
              kind: "text",
              cfg: ctx.cfg as Config,
              to: ctx.to,
              text: ctx.text,
              accountId: ctx.accountId,
            }),
        }
      : {}),
    ...(descriptor.channel.hasOutboundPayload
      ? {
          sendPayload: async (ctx) =>
            await this.client.sendChannelOutbound({
              pluginId: descriptor.pluginId,
              channelId: descriptor.channel.id,
              kind: "payload",
              cfg: ctx.cfg as Config,
              to: ctx.to,
              text: ctx.text,
              payload: ctx.payload,
              accountId: ctx.accountId,
            }),
        }
      : {}),
  });

  private createProxyTools = (
    descriptor: ExtensionHostToolDescriptor,
    context: OpenClawPluginToolContext,
  ): OpenClawPluginTool[] =>
    descriptor.names.map((alias) => {
      const preview = pickPreview({ descriptor, alias });
      return this.createProxyTool(descriptor, alias, context, preview ?? undefined);
    });

  private createProxyTool = (
    descriptor: ExtensionHostToolDescriptor,
    alias: string,
    context: OpenClawPluginToolContext,
    preview?: ExtensionHostToolDescriptor["previews"][number],
  ): OpenClawPluginTool => ({
    name: preview?.name ?? alias,
    ...(preview?.label ? { label: preview.label } : {}),
    description: preview?.description ?? `Extension tool '${alias}' from ${descriptor.pluginId}`,
    parameters: normalizeSchema(preview?.parameters),
    execute: async (toolCallIdOrParams: string | Record<string, unknown>, maybeParams?: Record<string, unknown>) => {
      const hasToolCallId = typeof toolCallIdOrParams === "string";
      const params = hasToolCallId ? maybeParams ?? {} : toolCallIdOrParams;
      const toolCallId = hasToolCallId ? toolCallIdOrParams : undefined;
      return stringifyToolResult(
        await this.client.executeTool({
          registrationId: descriptor.registrationId,
          alias,
          context,
          params,
          toolCallId,
        }),
      );
    },
  });
}
