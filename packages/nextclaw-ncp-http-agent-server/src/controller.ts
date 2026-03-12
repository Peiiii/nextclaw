import {
  parseAbortPayload,
  parseRequestEnvelope,
  parseResumePayloadFromUrl,
} from "./parsers.js";
import { createForwardResponse, createReplayResponse } from "./stream-handlers.js";
import { jsonResponse } from "./utils.js";
import type { NcpHttpAgentHandler, NcpHttpAgentHandlerOptions } from "./handler-interface.js";

/**
 * Framework-agnostic controller for NCP agent HTTP routes.
 * Forwards /send and /reconnect to agentClientEndpoint; /reconnect uses replayProvider when set.
 */
export class NcpHttpAgentController implements NcpHttpAgentHandler {
  constructor(private readonly options: NcpHttpAgentHandlerOptions) {}

  async handleSend(request: Request): Promise<Response> {
    const { agentClientEndpoint, timeoutMs } = this.options;
    const envelope = await parseRequestEnvelope(request);
    if (!envelope) {
      return jsonResponse(
        { ok: false, error: { code: "INVALID_BODY", message: "Invalid NCP request envelope." } },
        400,
      );
    }

    return createForwardResponse({
      endpoint: agentClientEndpoint,
      requestEvent: { type: "message.request", payload: envelope },
      requestSignal: request.signal,
      timeoutMs,
      scope: {
        sessionId: envelope.sessionId,
        correlationId: envelope.correlationId,
      },
    });
  }

  async handleReconnect(request: Request): Promise<Response> {
    const { agentClientEndpoint, replayProvider, timeoutMs } = this.options;
    const resumePayload = parseResumePayloadFromUrl(request.url);
    if (!resumePayload) {
      return jsonResponse(
        { ok: false, error: { code: "INVALID_QUERY", message: "sessionId and remoteRunId are required." } },
        400,
      );
    }

    if (replayProvider) {
      return createReplayResponse({
        replayProvider,
        payload: resumePayload,
        signal: request.signal,
      });
    }

    return createForwardResponse({
      endpoint: agentClientEndpoint,
      requestEvent: { type: "message.resume-request", payload: resumePayload },
      requestSignal: request.signal,
      timeoutMs,
      scope: {
        sessionId: resumePayload.sessionId,
        runId: resumePayload.remoteRunId,
      },
    });
  }

  async handleAbort(request: Request): Promise<Response> {
    const { agentClientEndpoint } = this.options;
    const payload = await parseAbortPayload(request);
    await agentClientEndpoint.abort(payload);
    return jsonResponse({ ok: true });
  }
}
