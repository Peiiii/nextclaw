import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";
import {
  buildNcpUserMessage,
  type NcpRunnerAgent,
  type RunPromptOverNcpParams,
} from "../nextclaw-ncp-runner.js";
import { extractTextFromNcpMessage } from "../../nextclaw-ncp-message-bridge.js";

export type StreamPromptOverNcpParams = Omit<
  RunPromptOverNcpParams,
  "onAssistantDelta" | "missingCompletedMessageError" | "runErrorMessage"
>;

export async function* streamPromptOverNcp(
  params: StreamPromptOverNcpParams,
): AsyncGenerator<NcpEndpointEvent> {
  const {
    abortSignal,
    agent,
    attachments,
    content,
    metadata,
    onEvent,
    sessionId,
  } = params;
  const message = await buildNcpUserMessage({
    sessionId,
    content,
    attachments,
    metadata,
    assetApi: agent.assetApi,
  });

  for await (const event of agent.runApi.send(
    {
      sessionId,
      message,
      metadata,
    },
    {
      ...(abortSignal ? { signal: abortSignal } : {}),
    },
  )) {
    onEvent?.(event);
    yield event;
  }
}

export async function collectPromptOverNcpReply(
  params: RunPromptOverNcpParams,
): Promise<{
  text: string;
  completedMessage: NcpMessage;
}> {
  let completedMessage: NcpMessage | undefined;

  for await (const event of streamPromptOverNcp(params)) {
    if (event.type === NcpEventType.MessageTextDelta) {
      params.onAssistantDelta?.(event.payload.delta);
      continue;
    }

    if (event.type === NcpEventType.MessageFailed) {
      throw new Error(event.payload.error.message);
    }

    if (event.type === NcpEventType.RunError) {
      throw new Error(
        event.payload.error ?? params.runErrorMessage ?? "NCP run failed.",
      );
    }

    if (event.type === NcpEventType.MessageCompleted) {
      completedMessage = event.payload.message;
    }
  }

  if (!completedMessage) {
    throw new Error(
      params.missingCompletedMessageError ??
        "NCP run completed without a final assistant message.",
    );
  }

  return {
    text: extractTextFromNcpMessage(completedMessage),
    completedMessage,
  };
}

export type { NcpRunnerAgent };
