import {
  type NcpAgentClientEndpoint,
  type NcpAgentServerEndpoint,
  type NcpEndpointEvent,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";

/**
 * Creates an NcpAgentClientEndpoint that forwards to an in-process NcpAgentServerEndpoint.
 * Use when the agent runs in-process and you need to pass a client endpoint to the HTTP server.
 */
export function createAgentClientFromServer(
  server: NcpAgentServerEndpoint,
): NcpAgentClientEndpoint {
  return {
    get manifest() {
      return server.manifest;
    },
    async start(): Promise<void> {
      await server.start();
    },
    async stop(): Promise<void> {
      await server.stop();
    },
    async emit(event: NcpEndpointEvent): Promise<void> {
      await server.emit(event);
    },
    subscribe(listener: NcpEndpointSubscriber) {
      return server.subscribe(listener);
    },
    async send(envelope: NcpRequestEnvelope): Promise<void> {
      await server.emit({ type: NcpEventType.MessageRequest, payload: envelope });
    },
    async stream(payload: NcpStreamRequestPayload): Promise<void> {
      await server.emit({ type: NcpEventType.MessageStreamRequest, payload });
    },
    async abort(payload?: NcpMessageAbortPayload): Promise<void> {
      await server.emit({ type: NcpEventType.MessageAbort, payload: payload ?? {} });
    },
  };
}
