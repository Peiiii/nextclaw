import type {
  ClaudeCodeMessage,
  ClaudeCodeSdkModule,
  ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "@claude-code-sdk/types/claude-code-sdk.types.js";
import {
  buildQueryEnv,
  DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS,
  extractAssistantSnapshot,
  extractFailureMessage,
} from "./claude-code-runtime.utils.js";

export type ClaudeCodeExecutionProbeConfig = Pick<
  ClaudeCodeSdkNcpAgentRuntimeConfig,
  "apiKey" | "authToken" | "apiBase" | "env" | "workingDirectory" | "baseQueryOptions"
> & {
  executionProbePrompt?: string;
  executionProbeTimeoutMs?: number;
};

export type ClaudeCodeExecutionProbeCliConfig = {
  pathToClaudeCodeExecutable?: string;
  executable?: string;
  executableArgs?: string[];
  permissionMode?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function classifyProbeFailureReason(reasonMessage: string): string {
  const normalized = reasonMessage.toLowerCase();
  if (
    normalized.includes("authenticate") ||
    normalized.includes("api key") ||
    normalized.includes("oauth") ||
    normalized.includes("subscription") ||
    normalized.includes("auth token")
  ) {
    return "authentication_failed";
  }
  if (normalized.includes("timed out")) {
    return "probe_timed_out";
  }
  return "execution_probe_failed";
}

function extractExecutionProbeFailure(message: ClaudeCodeMessage): string | null {
  const failure = extractFailureMessage(message);
  if (failure) {
    return failure;
  }

  if (message.type !== "assistant") {
    return null;
  }

  const assistantText = extractAssistantSnapshot(message);
  if (!assistantText) {
    return null;
  }
  if (/failed to authenticate/i.test(assistantText)) {
    return assistantText;
  }
  return null;
}

export async function probeClaudeCodeSdkExecution(params: {
  sdk: ClaudeCodeSdkModule;
  config: ClaudeCodeExecutionProbeConfig;
  cliConfig: ClaudeCodeExecutionProbeCliConfig;
  model: string;
  withTimeout: <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;
}): Promise<{
  ready: boolean;
  reason: string | null;
  reasonMessage: string | null;
}> {
  const { cliConfig, config, model, sdk, withTimeout } = params;
  const query = sdk.query({
    prompt: readString(config.executionProbePrompt) ?? "Reply with exactly: NEXTCLAW_CLAUDE_READY",
    options: {
      cwd: config.workingDirectory,
      model,
      env: buildQueryEnv({
        sessionId: "claude-execution-probe",
        apiKey: readString(config.apiKey) ?? "",
        authToken: readString(config.authToken) ?? undefined,
        apiBase: config.apiBase,
        model,
        workingDirectory: config.workingDirectory,
        env: config.env,
        baseQueryOptions: config.baseQueryOptions,
      }),
      pathToClaudeCodeExecutable: cliConfig.pathToClaudeCodeExecutable,
      executable: cliConfig.executable,
      executableArgs: cliConfig.executableArgs,
      permissionMode: cliConfig.permissionMode,
      allowedTools: cliConfig.allowedTools,
      disallowedTools: cliConfig.disallowedTools,
      includePartialMessages: false,
      maxTurns: 1,
      persistSession: false,
      ...(config.baseQueryOptions ?? {}),
    },
  });

  const executeProbe = async () => {
    let sawAssistantOutput = false;
    for await (const message of query) {
      const failure = extractExecutionProbeFailure(message);
      if (failure) {
        return {
          ready: false,
          reason: classifyProbeFailureReason(failure),
          reasonMessage: failure,
        };
      }

      if (extractAssistantSnapshot(message)) {
        sawAssistantOutput = true;
      }

      if (message.type === "result") {
        return {
          ready: true,
          reason: null,
          reasonMessage: null,
        };
      }
    }

    if (sawAssistantOutput) {
      return {
        ready: true,
        reason: null,
        reasonMessage: null,
      };
    }

    return {
      ready: false,
      reason: "execution_probe_failed",
      reasonMessage: "Claude runtime did not return a final response during the readiness probe.",
    };
  };

  try {
    const timeoutMs = Math.max(
      1000,
      Math.trunc(config.executionProbeTimeoutMs ?? DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS),
    );
    return await withTimeout(executeProbe(), timeoutMs);
  } catch (error) {
    const reasonMessage = error instanceof Error ? error.message : "claude execution probe failed";
    return {
      ready: false,
      reason: classifyProbeFailureReason(reasonMessage),
      reasonMessage,
    };
  } finally {
    query.close?.();
  }
}
