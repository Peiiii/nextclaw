import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";

export type AgentRunModelSource = "request" | "session" | "default";

export type AgentRunExecutionMetadata = {
  contractVersion: 1;
  modelProtocol: "ncp-agent-run";
  terminalContracts: string[];
  retryPolicy: {
    requestMaxAttempts: number;
    streamMaxAttemptsBeforeVisibleOutput: number;
    scope: "transport-or-missing-terminal-before-visible-output";
    runtimeStreamRetry: {
      attemptLimit: null;
      backoffFactor: 2;
      initialDelayMs: 2000;
      maxDelayMsWithoutHeaders: 30000;
      partialAttemptDisposition: "retain-visible-parts";
      scope: "retryable-model-stream-failure";
      statusFields: ["attempt", "message", "action", "next"];
      statusMetadataType: "retry";
    };
  };
};

export type AgentRunMessageRunSpecMetadata = {
  version: 1;
  runId: string;
  startedAt: string;
  sessionId: string;
  agentRuntimeId: string;
  agentId: string;
  model: string;
  modelSource: AgentRunModelSource;
  requestedModel: string | null;
  maxTokens: number | undefined;
  thinkingEffort: ThinkingEffort | null | undefined;
  projectRoot: string | null;
  workingDir: string | null;
  correlationId: string | null;
  execution: AgentRunExecutionMetadata;
};

export const AGENT_RUN_EXECUTION_METADATA: AgentRunExecutionMetadata = {
  contractVersion: 1,
  modelProtocol: "ncp-agent-run",
  terminalContracts: ["chat.finish_reason", "responses.response.completed", "ncp.run.finished-or-error-or-abort"],
  retryPolicy: {
    requestMaxAttempts: 3,
    streamMaxAttemptsBeforeVisibleOutput: 3,
    scope: "transport-or-missing-terminal-before-visible-output",
    runtimeStreamRetry: {
      attemptLimit: null,
      backoffFactor: 2,
      initialDelayMs: 2000,
      maxDelayMsWithoutHeaders: 30000,
      partialAttemptDisposition: "retain-visible-parts",
      scope: "retryable-model-stream-failure",
      statusFields: ["attempt", "message", "action", "next"],
      statusMetadataType: "retry",
    },
  },
};
