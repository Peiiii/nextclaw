import {
  type NcpEndpointEvent,
  NcpEventType,
  type NcpRequestEnvelope,
  type NcpRunHandle,
} from "../types/index.js";

export function createNcpRunHandle(envelope: NcpRequestEnvelope): NcpRunHandle {
  return {
    sessionId: envelope.sessionId,
    userMessageId: envelope.message.id,
    assistantMessageId: null,
    runId: null,
    ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
  };
}

export function consumeNcpRunHandle(
  events: AsyncIterable<NcpEndpointEvent>,
  fallback: NcpRunHandle,
): Promise<NcpRunHandle> {
  let resolved = false;
  let handle = fallback;

  return new Promise<NcpRunHandle>((resolve, reject) => {
    const resolveOnce = (): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(handle);
    };

    void (async () => {
      try {
        for await (const event of events) {
          if (event.type === NcpEventType.RunStarted) {
            handle = {
              ...handle,
              assistantMessageId: event.payload.messageId ?? null,
              runId: event.payload.runId ?? null,
            };
            resolveOnce();
          }
        }
        resolveOnce();
      } catch (error) {
        if (!resolved) reject(error);
      }
    })();
  });
}
