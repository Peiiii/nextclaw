import type { NcpAgentRunOptions } from "@nextclaw/ncp";
import type { ClaudeCodeQueryOptions, ClaudeCodeSdkNcpAgentRuntimeConfig } from "@/claude-code-sdk-types.js";
import { buildQueryEnv, resolveClaudeGatewayAccess } from "./claude-code-runtime.utils.js";

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

export function buildClaudeQueryOptions(params: {
  config: ClaudeCodeSdkNcpAgentRuntimeConfig;
  abortController: AbortController;
  preparedAccess: ClaudePreparedGatewayAccess;
  bundledCliPath?: string;
  currentProcessExecutable?: string;
  sessionRuntimeId?: string | null;
}): ClaudeCodeQueryOptions {
  const {
    abortController,
    bundledCliPath,
    config,
    currentProcessExecutable,
    preparedAccess,
    sessionRuntimeId,
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

  return {
    ...baseQueryOptions,
    abortController,
    cwd: config.workingDirectory,
    model: config.model,
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
