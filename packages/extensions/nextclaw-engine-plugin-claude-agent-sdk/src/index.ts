import { createRequire } from "node:module";
import type {
  Options as ClaudeAgentOptions,
  Query as ClaudeAgentQuery,
  SDKMessage
} from "@anthropic-ai/claude-agent-sdk";
import {
  getApiBase,
  buildRequestedSkillsUserPrompt,
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

function readNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function readRecord(input: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringRecord(input: Record<string, unknown>, key: string): Record<string, string> | undefined {
  const value = readRecord(input, key);
  if (!value) {
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

function readStringOrNullRecord(
  input: Record<string, unknown>,
  key: string
): Record<string, string | null> | undefined {
  const value = readRecord(input, key);
  if (!value) {
    return undefined;
  }
  const out: Record<string, string | null> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string") {
      out[entryKey] = entryValue.trim();
      continue;
    }
    if (entryValue === null) {
      out[entryKey] = null;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
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

function readPermissionMode(
  input: Record<string, unknown>,
  key: string
): "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | undefined {
  const value = readString(input, key);
  if (
    value === "default" ||
    value === "acceptEdits" ||
    value === "bypassPermissions" ||
    value === "plan" ||
    value === "dontAsk"
  ) {
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

function readSettingSources(input: Record<string, unknown>, key: string): Array<"user" | "project" | "local"> | undefined {
  const list = readStringArray(input, key);
  if (!list) {
    return undefined;
  }
  const out: Array<"user" | "project" | "local"> = [];
  for (const entry of list) {
    if (entry === "user" || entry === "project" || entry === "local") {
      out.push(entry);
    }
  }
  return out.length > 0 ? out : undefined;
}

function readExecutable(input: Record<string, unknown>, key: string): "node" | "bun" | "deno" | undefined {
  const value = readString(input, key);
  if (value === "node" || value === "bun" || value === "deno") {
    return value;
  }
  return undefined;
}

function normalizeClaudeModel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("/")) {
    return trimmed;
  }
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
}

function resolveEngineConfig(config: Config, model: string, engineConfig: Record<string, unknown>) {
  const provider = getProvider(config, model);
  const apiKey = readString(engineConfig, "apiKey") ?? provider?.apiKey ?? undefined;
  const apiBase = readString(engineConfig, "apiBase") ?? getApiBase(config, model) ?? undefined;
  return { apiKey, apiBase };
}

type PluginClaudeAgentSdkEngineOptions = {
  bus: MessageBus;
  sessionManager: SessionManager;
  model: string;
  workspace: string;
  apiKey?: string;
  apiBase?: string;
  env?: Record<string, string>;
  baseQueryOptions: Partial<ClaudeAgentOptions>;
  requestTimeoutMs: number;
};

type ClaudeAgentSdkModule = {
  query: (params: { prompt: string; options?: ClaudeAgentOptions }) => ClaudeAgentQuery;
};

type ClaudeAgentLoader = {
  loadClaudeAgentSdkModule: () => Promise<ClaudeAgentSdkModule>;
};

const require = createRequire(import.meta.url);
const claudeAgentLoader = require("../claude-agent-sdk-loader.cjs") as ClaudeAgentLoader;

class PluginClaudeAgentSdkEngine implements AgentEngine {
  readonly kind = "claude-agent-sdk";
  readonly supportsAbort = true;

  private sdkModulePromise: Promise<ClaudeAgentSdkModule> | null = null;
  private sessionIdsByKey = new Map<string, string>();
  private defaultModel: string;
  private skillsLoader: SkillsLoader;

  constructor(private options: PluginClaudeAgentSdkEngineOptions) {
    this.defaultModel = options.model;
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
    const sessionKey =
      typeof params.sessionKey === "string" && params.sessionKey.trim() ? params.sessionKey : "cli:direct";
    const channel = typeof params.channel === "string" && params.channel.trim() ? params.channel : "cli";
    const chatId = typeof params.chatId === "string" && params.chatId.trim() ? params.chatId : "direct";
    const session = this.options.sessionManager.getOrCreate(sessionKey);
    const modelInput = readString(params.metadata ?? {}, "model") ?? this.defaultModel;
    const model = normalizeClaudeModel(modelInput);
    const requestedSkills = readRequestedSkills(params.metadata ?? {});

    const userExtra: Record<string, unknown> = { channel, chatId };
    if (requestedSkills.length > 0) {
      userExtra.requested_skills = requestedSkills;
    }
    const userEvent = this.options.sessionManager.addMessage(session, "user", params.content, userExtra);
    params.onSessionEvent?.(userEvent);

    const sdk = await this.getSdkModule();
    const abortController = new AbortController();
    const onExternalAbort = () => {
      if (!abortController.signal.aborted) {
        abortController.abort(params.abortSignal?.reason);
      }
    };
    if (params.abortSignal?.aborted) {
      onExternalAbort();
    } else {
      params.abortSignal?.addEventListener("abort", onExternalAbort, { once: true });
    }
    const timeout = this.createRequestTimeout(abortController);
    const queryOptions = this.buildQueryOptions(sessionKey, model, abortController);
    const prompt = buildRequestedSkillsUserPrompt(this.skillsLoader, requestedSkills, params.content);

    const query = sdk.query({
      prompt,
      options: queryOptions
    });

    const assistantMessages: string[] = [];
    let resultReply = "";

    try {
      for await (const message of query) {
        this.trackSessionId(sessionKey, message);

        const streamEvent = this.options.sessionManager.appendEvent(session, {
          type: this.toSessionEventType(message),
          data: { message },
          timestamp: new Date().toISOString()
        });
        params.onSessionEvent?.(streamEvent);

        const delta = this.extractAssistantDelta(message);
        if (delta) {
          params.onAssistantDelta?.(delta);
        }

        const assistantText = this.extractAssistantText(message);
        if (assistantText) {
          assistantMessages.push(assistantText);
        }

        const result = this.extractResultMessage(message);
        if (!result) {
          continue;
        }
        if (!result.ok) {
          throw new Error(result.error);
        }
        resultReply = result.text;
      }
    } finally {
      params.abortSignal?.removeEventListener("abort", onExternalAbort);
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      query.close();
    }
    if (abortController.signal.aborted) {
      throw toAbortError(abortController.signal.reason);
    }

    const assistantReply = assistantMessages.join("\n").trim();
    const reply = assistantReply || resultReply.trim();
    const assistantEvent: SessionEvent = this.options.sessionManager.addMessage(session, "assistant", reply, {
      channel,
      chatId
    });
    params.onSessionEvent?.(assistantEvent);
    this.options.sessionManager.save(session);
    return reply;
  }

  applyRuntimeConfig(_config: Config): void {}

  private async getSdkModule(): Promise<ClaudeAgentSdkModule> {
    if (!this.sdkModulePromise) {
      this.sdkModulePromise = claudeAgentLoader.loadClaudeAgentSdkModule();
    }
    return this.sdkModulePromise;
  }

  private buildQueryOptions(sessionKey: string, model: string, abortController: AbortController): ClaudeAgentOptions {
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...(this.options.env ?? {})
    };
    if (this.options.apiKey) {
      env.ANTHROPIC_API_KEY = this.options.apiKey;
    }
    if (this.options.apiBase) {
      env.ANTHROPIC_BASE_URL = this.options.apiBase;
      env.ANTHROPIC_API_URL = this.options.apiBase;
    }

    const options: ClaudeAgentOptions = {
      ...this.options.baseQueryOptions,
      abortController,
      cwd: this.options.workspace,
      model,
      env
    };

    const resumeSessionId = this.sessionIdsByKey.get(sessionKey);
    if (resumeSessionId) {
      options.resume = resumeSessionId;
    }

    if (options.permissionMode === "bypassPermissions" && options.allowDangerouslySkipPermissions !== true) {
      options.allowDangerouslySkipPermissions = true;
    }

    return options;
  }

  private createRequestTimeout(abortController: AbortController): ReturnType<typeof setTimeout> | null {
    if (this.options.requestTimeoutMs <= 0) {
      return null;
    }
    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.options.requestTimeoutMs);
    timeout.unref?.();
    return timeout;
  }

  private trackSessionId(sessionKey: string, message: SDKMessage): void {
    const maybeSessionId =
      message && typeof message === "object" && "session_id" in message ? (message.session_id as unknown) : undefined;
    if (typeof maybeSessionId === "string" && maybeSessionId.trim()) {
      this.sessionIdsByKey.set(sessionKey, maybeSessionId.trim());
    }
  }

  private toSessionEventType(message: SDKMessage): string {
    const baseType =
      message && typeof message === "object" && "type" in message && typeof message.type === "string"
        ? message.type
        : "unknown";
    const maybeSubtype =
      message && typeof message === "object" && "subtype" in message ? (message.subtype as unknown) : undefined;
    if (typeof maybeSubtype === "string" && maybeSubtype.trim()) {
      return `engine.claude.${baseType}.${maybeSubtype.trim()}`;
    }
    return `engine.claude.${baseType}`;
  }

  private extractAssistantText(message: SDKMessage): string {
    if (message.type !== "assistant") {
      return "";
    }
    const payload = (message as { message?: { content?: unknown } }).message;
    const content = payload?.content;
    if (typeof content === "string") {
      return content.trim();
    }
    if (!Array.isArray(content)) {
      return "";
    }
    const text = content
      .map((block) => {
        if (!block || typeof block !== "object") {
          return "";
        }
        const candidate = block as { type?: unknown; text?: unknown };
        if (candidate.type !== "text" || typeof candidate.text !== "string") {
          return "";
        }
        return candidate.text;
      })
      .join("")
      .trim();
    return text;
  }

  private extractAssistantDelta(message: SDKMessage): string {
    if (message.type !== "stream_event") {
      return "";
    }
    const event = (message as { event?: unknown }).event;
    if (!event || typeof event !== "object") {
      return "";
    }
    const eventObj = event as { type?: unknown; delta?: unknown; text?: unknown };
    if (eventObj.type === "content_block_delta") {
      const delta = eventObj.delta as { type?: unknown; text?: unknown } | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        return delta.text;
      }
    }
    if (typeof eventObj.text === "string") {
      return eventObj.text;
    }
    return "";
  }

  private extractResultMessage(message: SDKMessage): { ok: true; text: string } | { ok: false; error: string } | null {
    if (message.type !== "result") {
      return null;
    }
    if (message.subtype === "success") {
      return { ok: true, text: typeof message.result === "string" ? message.result : "" };
    }
    const errors = Array.isArray(message.errors)
      ? message.errors.map((entry) => String(entry)).filter(Boolean)
      : [];
    return {
      ok: false,
      error: errors.join("; ") || `claude-agent-sdk execution failed: ${message.subtype}`
    };
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
  id: "nextclaw-engine-claude-agent-sdk",
  name: "NextClaw Claude Agent SDK Engine",
  description: "Registers engine kind `claude-agent-sdk` backed by Anthropic Claude Agent SDK.",
  configSchema: {
    type: "object",
    additionalProperties: true,
    properties: {}
  },
  register(api) {
    api.registerEngine(
      (context) => {
        const engineConfig = context.engineConfig ?? {};
        const modelInput = readString(engineConfig, "model") ?? context.model;
        const model = normalizeClaudeModel(modelInput);
        const resolved = resolveEngineConfig(context.config, modelInput, engineConfig);

        const permissionMode = readPermissionMode(engineConfig, "permissionMode") ?? "bypassPermissions";
        const allowDangerouslySkipPermissions = readBoolean(engineConfig, "allowDangerouslySkipPermissions");
        const includePartialMessages = readBoolean(engineConfig, "includePartialMessages") ?? true;
        const maxTurns = readNumber(engineConfig, "maxTurns") ?? context.maxIterations;
        const maxThinkingTokens = readNumber(engineConfig, "maxThinkingTokens");
        const requestTimeoutMs = Math.max(0, Math.trunc(readNumber(engineConfig, "requestTimeoutMs") ?? 0));

        const baseQueryOptions: Partial<ClaudeAgentOptions> = {
          permissionMode,
          includePartialMessages,
          maxTurns,
          additionalDirectories: readStringArray(engineConfig, "additionalDirectories"),
          allowedTools: readStringArray(engineConfig, "allowedTools"),
          disallowedTools: readStringArray(engineConfig, "disallowedTools"),
          settingSources: readSettingSources(engineConfig, "settingSources"),
          pathToClaudeCodeExecutable:
            readString(engineConfig, "pathToClaudeCodeExecutable") ?? readString(engineConfig, "claudeCodePath"),
          executable: readExecutable(engineConfig, "executable"),
          executableArgs: readStringArray(engineConfig, "executableArgs"),
          extraArgs: readStringOrNullRecord(engineConfig, "extraArgs"),
          sandbox: readRecord(engineConfig, "sandbox") as ClaudeAgentOptions["sandbox"],
          persistSession: readBoolean(engineConfig, "persistSession"),
          continue: readBoolean(engineConfig, "continue"),
          ...(typeof maxThinkingTokens === "number" ? { maxThinkingTokens } : {})
        };

        if (typeof allowDangerouslySkipPermissions === "boolean") {
          baseQueryOptions.allowDangerouslySkipPermissions = allowDangerouslySkipPermissions;
        }

        return new PluginClaudeAgentSdkEngine({
          bus: context.bus,
          sessionManager: context.sessionManager,
          model,
          workspace: readString(engineConfig, "workingDirectory") ?? context.workspace,
          apiKey: resolved.apiKey,
          apiBase: resolved.apiBase,
          env: readStringRecord(engineConfig, "env"),
          baseQueryOptions,
          requestTimeoutMs
        });
      },
      { kind: "claude-agent-sdk" }
    );
  }
};

export default plugin;
