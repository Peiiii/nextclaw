import { createRequire } from "node:module";
import type { Codex as CodexClient, CodexOptions, Thread, ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import {
  getApiBase,
  getProvider,
  SkillsLoader,
  type AgentEngine,
  type AgentEngineDirectRequest,
  type AgentEngineFactoryContext,
  type AgentEngineInboundRequest,
  type Config,
  type MessageBus,
  type OutboundMessage,
  type SessionEvent,
  type SessionManager
} from "@nextclaw/core";

function readString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function readStringRecord(input: Record<string, unknown>, key: string): Record<string, string> | undefined {
  const value = input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue;
    }
    const normalized = entryValue.trim();
    if (!normalized) {
      continue;
    }
    out[entryKey] = normalized;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readRecord(input: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringArray(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function readRequestedSkills(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) {
    return [];
  }
  const raw = metadata.requested_skills ?? metadata.requestedSkills;
  const values: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== "string") {
        continue;
      }
      const trimmed = entry.trim();
      if (trimmed) {
        values.push(trimmed);
      }
    }
  } else if (typeof raw === "string") {
    values.push(
      ...raw
        .split(/[,\s]+/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
  }
  return Array.from(new Set(values)).slice(0, 8);
}

function readReasoningEffort(
  input: Record<string, unknown>,
  key: string
): "minimal" | "low" | "medium" | "high" | "xhigh" | undefined {
  const value = readString(input, key);
  if (value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return undefined;
}

function readSandboxMode(
  input: Record<string, unknown>,
  key: string
): "read-only" | "workspace-write" | "danger-full-access" | undefined {
  const value = readString(input, key);
  if (value === "read-only" || value === "workspace-write" || value === "danger-full-access") {
    return value;
  }
  return undefined;
}

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  const message = typeof reason === "string" && reason.trim() ? reason.trim() : "operation aborted";
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function readApprovalPolicy(
  input: Record<string, unknown>,
  key: string
): "never" | "on-request" | "on-failure" | "untrusted" | undefined {
  const value = readString(input, key);
  if (value === "never" || value === "on-request" || value === "on-failure" || value === "untrusted") {
    return value;
  }
  return undefined;
}

function readWebSearchMode(input: Record<string, unknown>, key: string): "disabled" | "cached" | "live" | undefined {
  const value = readString(input, key);
  if (value === "disabled" || value === "cached" || value === "live") {
    return value;
  }
  return undefined;
}

function resolveEngineConfig(config: Config, model: string, engineConfig: Record<string, unknown>) {
  const provider = getProvider(config, model);
  const apiKey = readString(engineConfig, "apiKey") ?? provider?.apiKey ?? undefined;
  const apiBase = readString(engineConfig, "apiBase") ?? getApiBase(config, model) ?? undefined;
  return { apiKey, apiBase };
}

type PluginCodexSdkEngineOptions = {
  bus: MessageBus;
  sessionManager: SessionManager;
  model: string;
  workspace: string;
  apiKey: string;
  apiBase?: string;
  codexPathOverride?: string;
  env?: Record<string, string>;
  cliConfig?: CodexOptions["config"];
  threadOptions: ThreadOptions;
};

type CodexCtor = new (options: CodexOptions) => CodexClient;

type CodexLoader = {
  loadCodexConstructor: () => Promise<CodexCtor>;
};

const require = createRequire(import.meta.url);
const codexLoader = require("../codex-sdk-loader.cjs") as CodexLoader;

class PluginCodexSdkEngine implements AgentEngine {
  readonly kind = "codex-sdk";
  readonly supportsAbort = true;

  private codexPromise: Promise<CodexClient> | null = null;
  private threads = new Map<string, Thread>();
  private defaultModel: string;
  private threadOptions: ThreadOptions;
  private skillsLoader: SkillsLoader;

  constructor(private options: PluginCodexSdkEngineOptions) {
    this.defaultModel = options.model;
    this.threadOptions = options.threadOptions;
    this.skillsLoader = new SkillsLoader(options.workspace);
  }

  async handleInbound(params: AgentEngineInboundRequest): Promise<OutboundMessage | null> {
    const reply = await this.processDirect({
      content: params.message.content,
      sessionKey: params.sessionKey,
      channel: params.message.channel,
      chatId: params.message.chatId,
      metadata: params.message.metadata
    });
    if (!reply.trim()) {
      return null;
    }
    const outbound: OutboundMessage = {
      channel: params.message.channel,
      chatId: params.message.chatId,
      content: reply,
      media: [],
      metadata: {}
    };
    if (params.publishResponse ?? true) {
      await this.options.bus.publishOutbound(outbound);
    }
    return outbound;
  }

  async processDirect(params: AgentEngineDirectRequest): Promise<string> {
    const sessionKey = typeof params.sessionKey === "string" && params.sessionKey.trim() ? params.sessionKey : "cli:direct";
    const channel = typeof params.channel === "string" && params.channel.trim() ? params.channel : "cli";
    const chatId = typeof params.chatId === "string" && params.chatId.trim() ? params.chatId : "direct";
    const model = readString(params.metadata ?? {}, "model") ?? this.defaultModel;
    const requestedSkills = readRequestedSkills(params.metadata ?? {});
    const session = this.options.sessionManager.getOrCreate(sessionKey);

    const userExtra: Record<string, unknown> = { channel, chatId };
    if (requestedSkills.length > 0) {
      userExtra.requested_skills = requestedSkills;
    }
    const userEvent = this.options.sessionManager.addMessage(session, "user", params.content, userExtra);
    params.onSessionEvent?.(userEvent);

    const requestedSkillsContent = this.skillsLoader.loadSkillsForContext(requestedSkills);
    const prompt =
      requestedSkillsContent.trim().length > 0
        ? [
            "## Requested Skills",
            "Use the following selected skills for this turn:",
            requestedSkillsContent,
            "## User Message",
            params.content
          ].join("\n\n")
        : params.content;

    const thread = await this.resolveThread(sessionKey, model);
    const streamed = await thread.runStreamed(prompt, {
      ...(params.abortSignal ? { signal: params.abortSignal } : {})
    });
    const itemTextById = new Map<string, string>();
    const completedAgentMessages: string[] = [];

    for await (const event of streamed.events) {
      const streamEvent = this.options.sessionManager.appendEvent(session, {
        type: `engine.codex.${event.type}`,
        data: { event },
        timestamp: new Date().toISOString()
      });
      params.onSessionEvent?.(streamEvent);

      this.emitAssistantDelta(event, itemTextById, params.onAssistantDelta);
      if (event.type === "item.completed" && event.item.type === "agent_message") {
        const text = event.item.text.trim();
        if (text) {
          completedAgentMessages.push(text);
        }
      }
      if (event.type === "turn.failed") {
        throw new Error(event.error.message);
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
    if (params.abortSignal?.aborted) {
      throw toAbortError(params.abortSignal.reason);
    }

    const reply = completedAgentMessages.join("\n").trim();
    const assistantEvent: SessionEvent = this.options.sessionManager.addMessage(session, "assistant", reply, {
      channel,
      chatId
    });
    params.onSessionEvent?.(assistantEvent);
    this.options.sessionManager.save(session);
    return reply;
  }

  applyRuntimeConfig(_config: Config): void {}

  private async getCodex(): Promise<CodexClient> {
    if (!this.codexPromise) {
      this.codexPromise = codexLoader.loadCodexConstructor().then((Ctor) =>
        new Ctor({
          apiKey: this.options.apiKey,
          baseUrl: this.options.apiBase,
          ...(this.options.codexPathOverride ? { codexPathOverride: this.options.codexPathOverride } : {}),
          ...(this.options.env ? { env: this.options.env } : {}),
          ...(this.options.cliConfig ? { config: this.options.cliConfig } : {})
        })
      );
    }
    return this.codexPromise;
  }

  private async resolveThread(sessionKey: string, model: string): Promise<Thread> {
    const cached = this.threads.get(sessionKey);
    if (cached) {
      return cached;
    }
    const codex = await this.getCodex();
    const thread = codex.startThread({
      ...this.threadOptions,
      model
    });
    this.threads.set(sessionKey, thread);
    return thread;
  }

  private emitAssistantDelta(
    event: ThreadEvent,
    itemTextById: Map<string, string>,
    onAssistantDelta: ((delta: string) => void) | undefined
  ): void {
    if (!onAssistantDelta) {
      return;
    }
    if (event.type !== "item.updated" && event.type !== "item.completed") {
      return;
    }
    if (event.item.type !== "agent_message") {
      return;
    }
    const current = event.item.text ?? "";
    const previous = itemTextById.get(event.item.id) ?? "";
    if (current.length <= previous.length) {
      itemTextById.set(event.item.id, current);
      return;
    }
    const delta = current.slice(previous.length);
    if (delta) {
      onAssistantDelta(delta);
    }
    itemTextById.set(event.item.id, current);
  }
}

type PluginApi = {
  registerEngine: (factory: (context: AgentEngineFactoryContext) => AgentEngine, opts?: { kind?: string }) => void;
};

type PluginDefinition = {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
  register: (api: PluginApi) => void;
};

const plugin: PluginDefinition = {
  id: "nextclaw-engine-codex-sdk",
  name: "NextClaw Codex SDK Engine",
  description: "Registers engine kind `codex-sdk` backed by OpenAI Codex SDK.",
  configSchema: {
    type: "object",
    additionalProperties: true,
    properties: {}
  },
  register(api) {
    api.registerEngine(
      (context) => {
        const engineConfig = context.engineConfig ?? {};
        const model = readString(engineConfig, "model") ?? context.model;
        const resolved = resolveEngineConfig(context.config, model, engineConfig);
        if (!resolved.apiKey) {
          throw new Error(
            `[codex-sdk] missing apiKey. Set agents.defaults.engineConfig.apiKey or providers.*.apiKey for model "${model}".`
          );
        }
        return new PluginCodexSdkEngine({
          bus: context.bus,
          sessionManager: context.sessionManager,
          model,
          workspace: context.workspace,
          apiKey: resolved.apiKey,
          apiBase: resolved.apiBase,
          codexPathOverride: readString(engineConfig, "codexPathOverride"),
          env: readStringRecord(engineConfig, "env"),
          cliConfig: readRecord(engineConfig, "config") as CodexOptions["config"],
          threadOptions: {
            model,
            sandboxMode: readSandboxMode(engineConfig, "sandboxMode"),
            workingDirectory: readString(engineConfig, "workingDirectory") ?? context.workspace,
            skipGitRepoCheck: readBoolean(engineConfig, "skipGitRepoCheck"),
            modelReasoningEffort: readReasoningEffort(engineConfig, "modelReasoningEffort"),
            networkAccessEnabled: readBoolean(engineConfig, "networkAccessEnabled"),
            webSearchMode: readWebSearchMode(engineConfig, "webSearchMode"),
            webSearchEnabled: readBoolean(engineConfig, "webSearchEnabled"),
            approvalPolicy: readApprovalPolicy(engineConfig, "approvalPolicy"),
            additionalDirectories: readStringArray(engineConfig, "additionalDirectories")
          }
        });
      },
      { kind: "codex-sdk" }
    );
  }
};

export default plugin;
