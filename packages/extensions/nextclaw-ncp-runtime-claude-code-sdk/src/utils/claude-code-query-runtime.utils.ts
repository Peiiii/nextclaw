import type { NcpAgentRunOptions } from "@nextclaw/ncp";
import type { SessionStore } from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeCodeMessage,
  ClaudeCodeQueryOptions,
  ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "@claude-code-sdk/types/claude-code-sdk.types.js";
import {
  buildQueryEnv,
  isRetryableClaudeFailure,
  resolveClaudeGatewayAccess,
} from "./claude-code-runtime.utils.js";

export const MAX_CLAUDE_QUERY_ATTEMPTS = 3;

export type ClaudePreparedGatewayAccess = {
  apiKey: string;
  authToken?: string;
  apiBase?: string;
};

export async function prepareClaudeGatewayAccess(
  config: ClaudeCodeSdkNcpAgentRuntimeConfig,
): Promise<ClaudePreparedGatewayAccess> {
  return await resolveClaudeGatewayAccess({
    apiKey: config.apiKey,
    authToken: config.authToken,
    apiBase: config.apiBase,
    anthropicGateway: config.anthropicGateway,
  });
}

export function shouldRetryClaudeQuery(
  attempt: number,
  message: ClaudeCodeMessage,
  hasVisibleOutput: boolean,
): boolean {
  return attempt < MAX_CLAUDE_QUERY_ATTEMPTS &&
    !hasVisibleOutput &&
    isRetryableClaudeFailure(message);
}

export function buildClaudeQueryOptions(params: {
  config: ClaudeCodeSdkNcpAgentRuntimeConfig;
  abortController: AbortController;
  preparedAccess: ClaudePreparedGatewayAccess;
  bundledCliPath?: string;
  currentProcessExecutable?: string;
  sessionRuntimeId?: string | null;
  sessionStore: SessionStore;
}): ClaudeCodeQueryOptions {
  const {
    abortController,
    bundledCliPath,
    config,
    currentProcessExecutable,
    preparedAccess,
    sessionRuntimeId,
    sessionStore,
  } = params;
  const baseQueryOptions = config.baseQueryOptions ?? {};
  const resolvedCliPath =
    typeof baseQueryOptions.pathToClaudeCodeExecutable === "string"
      ? baseQueryOptions.pathToClaudeCodeExecutable
      : bundledCliPath;
  const resolvedExecutable =
    typeof baseQueryOptions.executable === "string"
      ? baseQueryOptions.executable
      : currentProcessExecutable;
  const workingDirectory = config.workingDirectory?.trim();
  if (!workingDirectory) {
    throw new Error("[claude-code-sdk] missing execution cwd for Claude Code runtime");
  }

  return {
    ...baseQueryOptions,
    abortController,
    cwd: workingDirectory,
    model: config.model,
    sessionStore,
    env: buildQueryEnv({
      ...config,
      apiKey: preparedAccess.apiKey,
      authToken: preparedAccess.authToken,
      apiBase: preparedAccess.apiBase,
    }),
    ...(resolvedCliPath ? { pathToClaudeCodeExecutable: resolvedCliPath } : {}),
    ...(resolvedExecutable ? { executable: resolvedExecutable } : {}),
    ...(sessionRuntimeId ? { resume: sessionRuntimeId } : {}),
  };
}

export function createAbortBridge(options?: NcpAgentRunOptions): {
  abortController: AbortController;
  dispose: () => void;
} {
  const abortController = new AbortController();
  const onExternalAbort = () => {
    if (!abortController.signal.aborted) {
      abortController.abort(options?.signal?.reason);
    }
  };

  if (options?.signal?.aborted) {
    onExternalAbort();
  } else {
    options?.signal?.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    abortController,
    dispose: () => {
      options?.signal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

export function createRequestTimeout(
  requestTimeoutMs: number | undefined,
  abortController: AbortController,
): ReturnType<typeof setTimeout> | null {
  const timeoutMs = Math.max(0, Math.trunc(requestTimeoutMs ?? 0));
  if (timeoutMs <= 0) {
    return null;
  }

  const timeout = setTimeout(() => {
    abortController.abort("claude request timed out");
  }, timeoutMs);
  timeout.unref?.();
  return timeout;
}

export function disposeClaudeQueryRun(params: {
  abortBridge: { dispose: () => void };
  query: { close?: () => void };
  timeout: ReturnType<typeof setTimeout> | null;
}): void {
  const { abortBridge, query, timeout } = params;
  abortBridge.dispose();
  if (timeout !== null) {
    clearTimeout(timeout);
  }
  query.close?.();
}
