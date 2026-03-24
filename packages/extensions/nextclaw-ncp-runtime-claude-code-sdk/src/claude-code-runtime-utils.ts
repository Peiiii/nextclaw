import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { NcpAgentRunInput } from "@nextclaw/ncp";
import { ensureAnthropicOpenAiBridge } from "./anthropic-openai-bridge.js";
import type {
  ClaudeCodeMessage,
  ClaudeCodeSdkAnthropicGatewayConfig,
  ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "./claude-code-sdk-types.js";

const NEXTCLAW_HOME_ENV_KEY = "NEXTCLAW_HOME";
const NEXTCLAW_DEFAULT_HOME_DIR = ".nextclaw";
export const DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS = 30_000;

function readEnvString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

function resolveNextclawDataDir(env: Record<string, string | undefined>): string {
  const override = readEnvString(env[NEXTCLAW_HOME_ENV_KEY]);
  if (override) {
    return ensureDir(resolve(override));
  }
  return ensureDir(resolve(homedir(), NEXTCLAW_DEFAULT_HOME_DIR));
}

function resolveClaudeConfigDir(env: Record<string, string | undefined>): string {
  const explicitConfigDir = readEnvString(env.CLAUDE_CONFIG_DIR);
  if (explicitConfigDir) {
    return ensureDir(resolve(explicitConfigDir));
  }
  return ensureDir(resolve(resolveNextclawDataDir(env), "runtime", "claude-code"));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readUserText(input: NcpAgentRunInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = message.parts
      .filter((part): part is Extract<typeof message.parts[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  const message = typeof reason === "string" && reason.trim() ? reason.trim() : "operation aborted";
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function buildQueryEnv(
  config: ClaudeCodeSdkNcpAgentRuntimeConfig,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...(config.env ?? {}),
  };
  env.CLAUDE_CONFIG_DIR = resolveClaudeConfigDir(env);

  if (config.apiKey.trim()) {
    env.ANTHROPIC_API_KEY = config.apiKey;
  }
  if (config.authToken?.trim()) {
    env.ANTHROPIC_AUTH_TOKEN = config.authToken.trim();
  }
  if (config.apiBase?.trim()) {
    env.ANTHROPIC_BASE_URL = config.apiBase.trim();
    env.ANTHROPIC_API_URL = config.apiBase.trim();
  }
  if (config.model?.trim()) {
    const model = config.model.trim();
    env.ANTHROPIC_MODEL = env.ANTHROPIC_MODEL?.trim() || model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = env.ANTHROPIC_DEFAULT_OPUS_MODEL?.trim() || model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = env.ANTHROPIC_DEFAULT_SONNET_MODEL?.trim() || model;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = env.ANTHROPIC_DEFAULT_HAIKU_MODEL?.trim() || model;
    env.ANTHROPIC_SMALL_FAST_MODEL = env.ANTHROPIC_SMALL_FAST_MODEL?.trim() || model;
  }

  return env;
}

export async function resolveClaudeGatewayAccess(params: {
  apiKey: string;
  authToken?: string;
  apiBase?: string;
  anthropicGateway?: ClaudeCodeSdkAnthropicGatewayConfig;
}): Promise<{
  apiKey: string;
  authToken?: string;
  apiBase?: string;
}> {
  if (!params.anthropicGateway) {
    return {
      apiKey: params.apiKey,
      authToken: params.authToken,
      apiBase: params.apiBase,
    };
  }

  const bridge = await ensureAnthropicOpenAiBridge(params.anthropicGateway);
  const fallbackCredential =
    readEnvString(params.apiKey) ??
    readEnvString(params.authToken) ??
    "nextclaw-local-claude-gateway";

  return {
    apiKey: fallbackCredential,
    authToken: undefined,
    apiBase: bridge.baseUrl,
  };
}

function readTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      const candidate = block as {
        type?: unknown;
        text?: unknown;
        content?: unknown;
      };
      if (candidate.type === "text" && typeof candidate.text === "string") {
        return candidate.text;
      }
      if (typeof candidate.content === "string") {
        return candidate.content;
      }
      return "";
    })
    .join("")
    .trim();
}

export function extractAssistantSnapshot(message: ClaudeCodeMessage): string {
  if (message.type === "assistant") {
    return readTextFromContent(message.message?.content);
  }
  if (message.type === "result" && typeof message.result === "string") {
    return message.result.trim();
  }
  return "";
}

export function extractAssistantDelta(message: ClaudeCodeMessage): string {
  if (message.type !== "stream_event" || !message.event || typeof message.event !== "object") {
    return "";
  }

  const event = message.event as {
    type?: unknown;
    delta?: unknown;
    text?: unknown;
    content?: unknown;
  };

  if (event.type === "content_block_delta") {
    const delta = event.delta as { type?: unknown; text?: unknown } | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      return delta.text;
    }
  }
  if (typeof event.text === "string") {
    return event.text;
  }
  if (typeof event.content === "string") {
    return event.content;
  }
  return "";
}

export function extractFailureMessage(message: ClaudeCodeMessage): string | null {
  if (message.type === "result") {
    if (message.is_error === true) {
      if (typeof message.result === "string" && message.result.trim()) {
        return message.result.trim();
      }
      const errors = Array.isArray(message.errors)
        ? message.errors.map((entry) => String(entry)).filter(Boolean)
        : [];
      return errors.join("; ") || "claude execution failed";
    }
    if (message.subtype === "success") {
      return null;
    }
    const errors = Array.isArray(message.errors)
      ? message.errors.map((entry) => String(entry)).filter(Boolean)
      : [];
    return errors.join("; ") || `claude execution failed: ${message.subtype ?? "unknown"}`;
  }

  if (message.type !== "error") {
    return null;
  }

  if (typeof message.error === "string" && message.error.trim()) {
    return message.error.trim();
  }
  if (typeof message.result === "string" && message.result.trim()) {
    return message.result.trim();
  }

  return "claude execution failed";
}
