import { NcpEventType } from "@nextclaw/ncp";
import {
  parseAbortPayload,
  parseRequestEnvelope,
  parseStreamPayloadFromUrl,
} from "./parsers.js";
import {
  createForwardResponse,
  createLiveStreamResponse,
  createSendStreamResponse,
} from "./stream-handlers.js";
import { jsonResponse } from "./utils.js";
import type {
  NcpHttpAgentHandler,
  NcpHttpAgentHandlerOptions,
} from "./handler-interface.js";

/**
 * Framework-agnostic controller for NCP agent HTTP routes.
 * Forwards /send and /stream to agentClientEndpoint; /stream uses streamProvider when set.
 */
export class NcpHttpAgentController implements NcpHttpAgentHandler {
  constructor(private readonly options: NcpHttpAgentHandlerOptions) {}

  async handleSend(request: Request): Promise<Response> {
    const { agentClientEndpoint } = this.options;
    const envelope = await parseRequestEnvelope(request);
    if (!envelope) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: "INVALID_BODY",
            message: "Invalid NCP request envelope.",
          },
        },
        400,
      );
    }

    if (acceptsEventStream(request)) {
      return createSendStreamResponse({
        endpoint: agentClientEndpoint,
        envelope,
        requestSignal: request.signal,
        timeoutMs: this.options.timeoutMs,
      });
    }

    await agentClientEndpoint.send(envelope);
    return jsonResponse({ ok: true });
  }

  async handleStream(request: Request): Promise<Response> {
    const { agentClientEndpoint, streamProvider } = this.options;
    const streamPayload = parseStreamPayloadFromUrl(request.url);
    if (!streamPayload) {
      return jsonResponse(
        {
          ok: false,
          error: { code: "INVALID_QUERY", message: "sessionId is required." },
        },
        400,
      );
    }

    if (streamProvider) {
      return createLiveStreamResponse({
        streamProvider,
        payload: streamPayload,
        signal: request.signal,
      });
    }

    return createForwardResponse({
      endpoint: agentClientEndpoint,
      requestEvent: {
        type: NcpEventType.MessageStreamRequest,
        payload: streamPayload,
      },
      requestSignal: request.signal,
      timeoutMs: null,
      scope: {
        sessionId: streamPayload.sessionId,
      },
    });
  }

  async handleAbort(request: Request): Promise<Response> {
    const { agentClientEndpoint } = this.options;
    const payload = await parseAbortPayload(request);
    if (!payload) {
      return jsonResponse(
        {
          ok: false,
          error: { code: "INVALID_BODY", message: "sessionId is required." },
        },
        400,
      );
    }
    await agentClientEndpoint.abort(payload);
    return jsonResponse({ ok: true });
  }
}

function acceptsEventStream(request: Request): boolean {
  return request.headers.get("accept")?.includes("text/event-stream") ?? false;
}
