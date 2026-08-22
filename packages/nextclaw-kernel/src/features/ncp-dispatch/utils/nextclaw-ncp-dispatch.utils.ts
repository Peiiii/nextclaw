import {
  AgentRouteResolver,
  parseAgentScopedSessionKey,
  type Config,
  type InboundAttachment,
  type InboundMessage,
} from "@nextclaw/core";
import { CommandRegistry } from "@kernel/services/command-registry.service.js";
import type {
  AgentRunClient,
  AgentRunExecution,
} from "@kernel/services/agent-run-client.service.js";
import { buildRunMetadata } from "@kernel/utils/agent-run-metadata.utils.js";
import { buildAgentRunSendPayload } from "@kernel/utils/agent-run-send-payload.utils.js";
import type { NcpEndpointEvent, NcpMessage } from "@nextclaw/ncp";
export type DirectPromptDispatchParams = {
  config: Config;
  agentRunClient: AgentRunClient;
  content: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  agentId?: string;
  abortSignal?: AbortSignal;
  onAssistantDelta?: (delta: string) => void;
  onEvent?: (event: NcpEndpointEvent) => void;
};

export type DirectPromptDispatchResult = {
  kind: "agent" | "command";
  agentId: string;
  sessionId: string;
  runId: string | null;
  text: string;
  completedMessage: NcpMessage | null;
};

export type DirectPromptDispatchExecution =
  | {
      kind: "command";
      result: DirectPromptDispatchResult;
    }
  | {
      kind: "agent";
      agentId: string;
      sessionId: string;
      execution: AgentRunExecution;
    };

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function createDirectInboundMessage(params: {
  content: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
}): InboundMessage {
  const { attachments, channel, chatId, content, metadata } = params;
  return {
    channel: channel ?? "cli",
    senderId: "user",
    chatId: chatId ?? "direct",
    content,
    timestamp: new Date(),
    attachments: attachments ?? [],
    metadata: structuredClone(metadata ?? {}),
  };
}

async function executeSlashCommandMaybe(params: {
  config: Config;
  rawContent: string;
  channel: string;
  chatId: string;
  sessionKey: string;
}): Promise<string | null> {
  const { channel, chatId, config, rawContent, sessionKey } = params;
  const trimmed = rawContent.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const registry = new CommandRegistry(config);
  const result = await registry.executeText(rawContent, {
    channel,
    chatId,
    senderId: "user",
    sessionKey,
  });
  return result?.content ?? null;
}

function resolveDirectRoute(params: {
  config: Config;
  content: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  agentId?: string;
}): {
  message: InboundMessage;
  route: ReturnType<AgentRouteResolver["resolveInbound"]>;
} {
  const { agentId, config, sessionKey } = params;
  const message = createDirectInboundMessage(params);
  const forcedAgentId =
    normalizeOptionalString(agentId) ??
    parseAgentScopedSessionKey(sessionKey)?.agentId ??
    undefined;
  const routeResolver = new AgentRouteResolver(config);
  const route = routeResolver.resolveInbound({
    message,
    forcedAgentId,
    sessionKeyOverride: sessionKey,
  });
  return {
    message,
    route,
  };
}

export async function startPromptOverNcpExecution(
  params: DirectPromptDispatchParams,
): Promise<DirectPromptDispatchExecution> {
  const {
    abortSignal,
    agentId,
    attachments,
    channel,
    chatId,
    config,
    content,
    metadata,
    onAssistantDelta,
    onEvent,
    agentRunClient,
    sessionKey,
  } = params;
  const { message, route } = resolveDirectRoute({
    config,
    content,
    sessionKey,
    channel,
    chatId,
    attachments,
    metadata,
    agentId,
  });
  const commandResult = await executeSlashCommandMaybe({
    config,
    rawContent: content,
    channel: message.channel,
    chatId: message.chatId,
    sessionKey: route.sessionKey,
  });
  if (commandResult) {
    return {
      kind: "command",
      result: {
        kind: "command",
        agentId: route.agentId,
        sessionId: route.sessionKey,
        runId: null,
        text: commandResult,
        completedMessage: null,
      },
    };
  }

  const execution = await agentRunClient.startRun(
    await buildAgentRunSendPayload({
      sessionId: route.sessionKey,
      content,
      attachments,
      metadata: buildRunMetadata({
        message,
        route,
      }),
    }),
    {
      abortSignal,
      onAssistantDelta,
      onEvent,
      missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
      runErrorMessage: `session "${route.sessionKey}" failed`,
    },
  );
  return {
    kind: "agent",
    agentId: route.agentId,
    sessionId: execution.handle.sessionId,
    execution,
  };
}

export async function dispatchPromptOverNcpResult(
  params: DirectPromptDispatchParams,
): Promise<DirectPromptDispatchResult> {
  const started = await startPromptOverNcpExecution(params);
  if (started.kind === "command") {
    return started.result;
  }
  const result = await started.execution.result;
  return {
    kind: "agent",
    agentId: started.agentId,
    sessionId: result.handle.sessionId,
    runId: result.handle.runId,
    text: result.text,
    completedMessage: result.completedMessage,
  };
}

export async function dispatchPromptOverNcp(
  params: DirectPromptDispatchParams,
): Promise<string> {
  return (await dispatchPromptOverNcpResult(params)).text;
}
