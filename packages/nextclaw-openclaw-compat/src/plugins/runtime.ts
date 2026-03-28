import { randomUUID } from "node:crypto";
import type { Config } from "@nextclaw/core";
import {
  buildBootstrapAwareUserPrompt,
  getWorkspacePath,
  readRequestedSkillsFromMetadata,
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
    const resolvedWorkspace = getWorkspacePath(workspace ?? params.defaultWorkspace);
    let skills = skillLoaders.get(resolvedWorkspace);
    if (!skills) {
      skills = new SkillsLoader(resolvedWorkspace);
      skillLoaders.set(resolvedWorkspace, skills);
    }

    return buildBootstrapAwareUserPrompt({
      workspace: resolvedWorkspace,
      contextConfig: params.config?.agents?.context,
      sessionKey,
      skills,
      skillNames: readRequestedSkillsFromMetadata(metadata),
      userMessage,
    });
  };
}

export function createPluginRuntime(params: { workspace: string; config?: Config }): PluginRuntime {
  const defaultModel = params.config?.agents?.defaults?.model ?? "";
  const maxToolIterations = Math.max(
    0,
    Math.trunc(params.config?.agents?.defaults?.maxToolIterations ?? 0),
  );
  const buildRuntimeUserPrompt = createRuntimeUserPromptBuilder({
    config: params.config,
    defaultWorkspace: params.workspace,
  });

  return {
    version: getPackageVersion(),
    agent: {
      defaults: {
        model: defaultModel,
        workspace: params.workspace,
        maxToolIterations,
      },
      resolveWorkspacePath: (workspace?: string) =>
        getWorkspacePath(workspace ?? params.workspace),
      resolveProviderRuntime: (model?: string) => {
        if (!params.config) {
          throw new Error("plugin runtime agent.resolveProviderRuntime requires host config");
        }
        return resolveProviderRuntime(params.config, model);
      },
      buildRuntimeUserPrompt,
    },
    config: {
      loadConfig: () => loadConfigWithFallback(params.config),
      writeConfigFile: async (next: Record<string, unknown>) => writeConfigWithFallback(next),
    },
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
    channel: {
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
      reply: {
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
      },
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
    },
  };
}
