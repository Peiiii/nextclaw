import { randomUUID } from "node:crypto";
import type { Config } from "@nextclaw/core";
import {
  buildBootstrapAwareUserPrompt,
  getWorkspacePath,
  readRequestedSkillsFromMetadata,
  resolveSessionWorkspacePath,
  resolveProviderRuntime,
  SkillsLoader,
} from "@nextclaw/core";
import { getPackageVersion } from "@nextclaw/core";
import { MemoryGetTool, MemorySearchTool } from "@nextclaw/core";
import type { OpenClawPluginTool, PluginReplyDispatchParams, PluginRuntime } from "./types.js";
import {
  hasControlCommand,
  resolveAgentRoute,
  resolveCommandAuthorizedFromAuthorizers,
  resolveTextChunkLimit,
  splitTextIntoChunks,
  asNumber,
  asRecord,
  asString,
} from "./runtime-shared.js";
import { createInboundDebouncer, resolveInboundDebounceMs } from "./runtime-debounce.js";
import {
  createReplyDispatcherWithTyping,
  dispatchReplyFromConfig,
  finalizeInboundContext,
  formatAgentEnvelope,
  resolveEnvelopeFormatOptions,
  resolveHumanDelayConfig,
  withReplyDispatcher,
  type ReplyDispatcher,
} from "./runtime-reply.js";
import {
  detectMimeFromBuffer,
  fetchRemoteMedia,
  loadWebMedia,
  saveMediaBuffer,
} from "./runtime-media.js";

export type PluginRuntimeBridge = {
  loadConfig?: () => Record<string, unknown>;
  writeConfigFile?: (next: Record<string, unknown>) => Promise<void>;
  dispatchReplyWithBufferedBlockDispatcher?: (params: PluginReplyDispatchParams) => Promise<void>;
};

let bridge: PluginRuntimeBridge = {};

export function setPluginRuntimeBridge(next: PluginRuntimeBridge | null): void {
  bridge = next ?? {};
}

function toPluginTool(tool: MemorySearchTool | MemoryGetTool): OpenClawPluginTool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: (params: Record<string, unknown>) => tool.execute(params),
  };
}

function loadConfigWithFallback(config?: Config): Record<string, unknown> {
  if (bridge.loadConfig) {
    return bridge.loadConfig();
  }
  return (config as unknown as Record<string, unknown>) ?? {};
}

async function writeConfigWithFallback(next: Record<string, unknown>): Promise<void> {
  if (!bridge.writeConfigFile) {
    throw new Error("plugin runtime config.writeConfigFile is unavailable outside gateway runtime");
  }
  await bridge.writeConfigFile(next);
}

async function dispatchReplyWithFallback(params: PluginReplyDispatchParams): Promise<void> {
  if (!bridge.dispatchReplyWithBufferedBlockDispatcher) {
    throw new Error("plugin runtime channel.reply dispatcher is unavailable outside gateway runtime");
  }
  await bridge.dispatchReplyWithBufferedBlockDispatcher(params);
}

function createRuntimeUserPromptBuilder(params: {
  config?: Config;
  defaultWorkspace: string;
}): PluginRuntime["agent"]["buildRuntimeUserPrompt"] {
  const skillLoaders = new Map<string, SkillsLoader>();

  return ({ workspace, sessionKey, metadata, userMessage }) => {
    const hostWorkspace = getWorkspacePath(params.defaultWorkspace);
    const resolvedWorkspace = resolveSessionWorkspacePath({
      sessionMetadata: metadata,
      workspace: workspace ?? params.defaultWorkspace,
      defaultWorkspace: params.defaultWorkspace,
    });
    let skills = skillLoaders.get(resolvedWorkspace);
    if (!skills) {
      skills = new SkillsLoader(resolvedWorkspace);
      skillLoaders.set(resolvedWorkspace, skills);
    }

    return buildBootstrapAwareUserPrompt({
      workspace: resolvedWorkspace,
      hostWorkspace,
      contextConfig: params.config?.agents?.context,
      sessionKey,
      metadata,
      skills,
      skillNames: readRequestedSkillsFromMetadata(metadata),
      userMessage,
    });
  };
}

type CreatePluginRuntimeParams = {
  workspace: string;
  config?: Config;
};

type PluginRuntimeAgent = PluginRuntime["agent"];

class PluginRuntimeAgentSection implements PluginRuntimeAgent {
  readonly defaults: PluginRuntimeAgent["defaults"];
  readonly buildRuntimeUserPrompt: PluginRuntimeAgent["buildRuntimeUserPrompt"];

  constructor(private readonly params: CreatePluginRuntimeParams) {
    this.defaults = {
      model: params.config?.agents?.defaults?.model ?? "",
      workspace: params.workspace,
      maxToolIterations: Math.max(
        0,
        Math.trunc(params.config?.agents?.defaults?.maxToolIterations ?? 0),
      ),
    };
    this.buildRuntimeUserPrompt = createRuntimeUserPromptBuilder({
      config: params.config,
      defaultWorkspace: params.workspace,
    });
  }

  resolveWorkspacePath = (workspace?: string) =>
    getWorkspacePath(workspace ?? this.params.workspace);

  resolveSessionWorkspacePath: PluginRuntimeAgent["resolveSessionWorkspacePath"] = (input) =>
    resolveSessionWorkspacePath({
      sessionMetadata: input.sessionMetadata,
      workspace: input.workspace,
      defaultWorkspace: this.params.workspace,
    });

  resolveProviderRuntime = (model?: string) => {
    if (!this.params.config) {
      throw new Error("plugin runtime agent.resolveProviderRuntime requires host config");
    }
    return resolveProviderRuntime(this.params.config, model);
  };
}

function createRuntimeConfigSection(
  params: CreatePluginRuntimeParams,
): PluginRuntime["config"] {
  return {
    loadConfig: () => loadConfigWithFallback(params.config),
    writeConfigFile: async (next: Record<string, unknown>) => writeConfigWithFallback(next),
  };
}

function createRuntimeReplySection(): PluginRuntime["channel"]["reply"] {
  return {
    resolveEnvelopeFormatOptions,
    formatAgentEnvelope,
    finalizeInboundContext,
    withReplyDispatcher: async (input) =>
      withReplyDispatcher({
        dispatcher: input.dispatcher as ReplyDispatcher,
        run: input.run as () => Promise<Record<string, unknown>>,
        onSettled:
          typeof input.onSettled === "function"
            ? (input.onSettled as () => void | Promise<void>)
            : undefined,
      }),
    dispatchReplyFromConfig: async (input) =>
      dispatchReplyFromConfig({
        ctx: asRecord(input.ctx),
        cfg: input.cfg,
        dispatcher: input.dispatcher as ReplyDispatcher,
        bridgeDispatch: dispatchReplyWithFallback,
        replyOptions: asRecord(input.replyOptions),
      }),
    createReplyDispatcherWithTyping: (input) =>
      createReplyDispatcherWithTyping({
        deliver: input.deliver as (payload: Record<string, unknown>, info: { kind: "tool" | "block" | "final" }) => Promise<void>,
        onError:
          typeof input.onError === "function"
            ? (input.onError as (error: unknown, info: { kind: "tool" | "block" | "final" }) => void)
            : undefined,
        onIdle:
          typeof input.onIdle === "function"
            ? (input.onIdle as () => void)
            : undefined,
        onReplyStart:
          typeof input.onReplyStart === "function"
            ? (input.onReplyStart as () => void | Promise<void>)
            : undefined,
      }),
    resolveHumanDelayConfig,
    dispatchReplyWithBufferedBlockDispatcher: async (dispatchParams) =>
      dispatchReplyWithFallback(dispatchParams),
  };
}

function createRuntimeChannelSection(): PluginRuntime["channel"] {
  return {
    media: {
      fetchRemoteMedia: async (input) =>
        fetchRemoteMedia({
          url: asString(input.url) ?? "",
          maxBytes: asNumber(input.maxBytes),
        }),
      saveMediaBuffer: async (buffer, contentType, direction, maxBytes, fileName) =>
        saveMediaBuffer(buffer, contentType, direction, maxBytes, fileName),
    },
    text: {
      chunkMarkdownText: (text, limit) => splitTextIntoChunks(text, limit),
      resolveMarkdownTableMode: () => "preserve",
      convertMarkdownTables: (text) => text,
      resolveTextChunkLimit,
      resolveChunkMode: () => "length",
      chunkTextWithMode: (text, limit) => splitTextIntoChunks(text, limit),
      hasControlCommand: (text) => hasControlCommand(text),
    },
    reply: createRuntimeReplySection(),
    routing: {
      resolveAgentRoute,
    },
    pairing: {
      readAllowFromStore: async () => [],
      upsertPairingRequest: async () => ({
        code: randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        created: true,
      }),
    },
    commands: {
      shouldComputeCommandAuthorized: (text) => hasControlCommand(text),
      resolveCommandAuthorizedFromAuthorizers,
    },
    debounce: {
      resolveInboundDebounceMs,
      createInboundDebouncer: <T>(input: Record<string, unknown>) =>
        createInboundDebouncer<T>({
          debounceMs: asNumber(input.debounceMs),
          buildKey:
            typeof input.buildKey === "function"
              ? (input.buildKey as (item: T) => string | null | undefined)
              : undefined,
          shouldDebounce:
            typeof input.shouldDebounce === "function"
              ? (input.shouldDebounce as (item: T) => boolean)
              : undefined,
          resolveDebounceMs:
            typeof input.resolveDebounceMs === "function"
              ? (input.resolveDebounceMs as (item: T) => number | undefined)
              : undefined,
          onFlush:
            typeof input.onFlush === "function"
              ? (input.onFlush as (items: T[]) => Promise<void>)
              : undefined,
          onError:
            typeof input.onError === "function"
              ? (input.onError as (error: unknown, items: T[]) => void)
              : undefined,
        }),
    },
  };
}

export function createPluginRuntime(params: CreatePluginRuntimeParams): PluginRuntime {
  return {
    version: getPackageVersion(),
    agent: new PluginRuntimeAgentSection(params),
    config: createRuntimeConfigSection(params),
    logging: {
      shouldLogVerbose: () => false,
    },
    media: {
      detectMime: async ({ buffer }) => detectMimeFromBuffer(buffer),
      loadWebMedia: async (url, options) => loadWebMedia(url, options),
    },
    tools: {
      createMemorySearchTool: () => toPluginTool(new MemorySearchTool(params.workspace)),
      createMemoryGetTool: () => toPluginTool(new MemoryGetTool(params.workspace)),
    },
    channel: createRuntimeChannelSection(),
  };
}
