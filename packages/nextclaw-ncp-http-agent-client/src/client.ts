import type {
  NcpAgentClientEndpoint,
  NcpEndpointEvent,
  NcpEndpointManifest,
  NcpEndpointSubscriber,
  NcpMessageAbortPayload,
  NcpRequestEnvelope,
  NcpResumeRequestPayload,
} from "@nextclaw/ncp";
import { consumeSseStream } from "./sse.js";
import { parseNcpEvent, parseNcpError } from "./parsers.js";
import {
  type FetchLike,
  DEFAULT_ENDPOINT_ID,
  toBaseUrl,
  resolveFetchImpl,
  normalizeBasePath,
  safeReadText,
  toNcpError,
  ncpErrorToError,
  isNcpHttpAgentClientError,
} from "./utils.js";

const SUPPORTED_PART_TYPES: NcpEndpointManifest["supportedPartTypes"] = [
  "text",
  "file",
  "source",
  "step-start",
  "reasoning",
  "tool-invocation",
  "card",
  "rich-text",
  "action",
  "extension",
];

export type NcpHttpAgentClientOptions = {
  baseUrl: string;
  basePath?: string;
  endpointId?: string;
  headers?: Record<string, string>;
  fetchImpl?: FetchLike;
};

type StreamRequestOptions = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
};

export class NcpHttpAgentClientEndpoint implements NcpAgentClientEndpoint {
  readonly manifest: NcpEndpointManifest;

  private readonly baseUrl: URL;
  private readonly basePath: string;
  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Record<string, string>;
  private readonly subscribers = new Set<NcpEndpointSubscriber>();
  private readonly activeControllers = new Set<AbortController>();
  private started = false;

  constructor(options: NcpHttpAgentClientOptions) {
    this.baseUrl = toBaseUrl(options.baseUrl);
    this.basePath = normalizeBasePath(options.basePath);
    this.fetchImpl = resolveFetchImpl(options.fetchImpl);
    this.defaultHeaders = options.headers ?? {};
    this.manifest = {
      endpointKind: "custom",
      endpointId: options.endpointId?.trim() || DEFAULT_ENDPOINT_ID,
      version: "0.1.0",
      supportsStreaming: true,
      supportsAbort: true,
      supportsProactiveMessages: false,
      supportsSessionResume: true,
      supportedPartTypes: SUPPORTED_PART_TYPES,
      expectedLatency: "seconds",
      metadata: { transport: "http+sse", scope: "agent" },
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.publish({ type: "endpoint.ready" });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;
    for (const controller of this.activeControllers) {
      controller.abort();
    }
    this.activeControllers.clear();
  }

  async emit(event: NcpEndpointEvent): Promise<void> {
    switch (event.type) {
      case "message.request":
        await this.send(event.payload);
        return;
      case "message.resume-request":
        await this.resume(event.payload);
        return;
      case "message.abort":
        await this.abort(event.payload);
        return;
      default:
        this.publish(event);
        return;
    }
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  async send(envelope: NcpRequestEnvelope): Promise<void> {
    await this.ensureStarted();
    await this.streamRequest({
      path: "/send",
      method: "POST",
      body: envelope,
    });
  }

  async resume(payload: NcpResumeRequestPayload): Promise<void> {
    await this.ensureStarted();
    const query = new URLSearchParams({
      sessionId: payload.sessionId,
      remoteRunId: payload.remoteRunId,
    });
    if (typeof payload.fromEventIndex === "number" && Number.isFinite(payload.fromEventIndex)) {
      query.set("fromEventIndex", String(Math.max(0, Math.trunc(payload.fromEventIndex))));
    }
    await this.streamRequest({
      path: `/reconnect?${query.toString()}`,
      method: "GET",
    });
  }

  async abort(payload: NcpMessageAbortPayload = {}): Promise<void> {
    await this.ensureStarted();
    const controller = new AbortController();
    this.activeControllers.add(controller);
    try {
      const response = await this.fetchImpl(this.resolveUrl("/abort"), {
        method: "POST",
        headers: {
          ...this.defaultHeaders,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Abort request failed with HTTP ${response.status}: ${await safeReadText(response)}`,
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const ncpError = toNcpError(error);
      this.publish({ type: "endpoint.error", payload: ncpError });
      throw ncpErrorToError(ncpError);
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  private async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.start();
    }
  }

  private publish(event: NcpEndpointEvent): void {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private resolveUrl(path: string): URL {
    return new URL(`${this.basePath}${path}`, this.baseUrl);
  }

  private async streamRequest(options: StreamRequestOptions): Promise<void> {
    const controller = new AbortController();
    this.activeControllers.add(controller);

    try {
      const response = await this.fetchImpl(this.resolveUrl(options.path), {
        method: options.method,
        headers: {
          ...this.defaultHeaders,
          accept: "text/event-stream",
          ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `NCP stream request failed with HTTP ${response.status}: ${await safeReadText(response)}`,
        );
      }

      if (!response.body) {
        throw new Error("NCP stream response has no body.");
      }

      for await (const frame of consumeSseStream(response.body)) {
        if (controller.signal.aborted) {
          return;
        }
        this.handleSseFrame(frame);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      if (isNcpHttpAgentClientError(error)) {
        throw error;
      }
      const ncpError = toNcpError(error);
      this.publish({ type: "endpoint.error", payload: ncpError });
      throw ncpErrorToError(ncpError);
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  private handleSseFrame(frame: { event: string; data: string }): void {
    if (frame.event === "ncp-event") {
      const event = parseNcpEvent(frame.data);
      if (!event) {
        this.publish({
          type: "endpoint.error",
          payload: {
            code: "runtime-error",
            message: "Received malformed ncp-event frame.",
          },
        });
        return;
      }
      this.publish(event);
      return;
    }

    if (frame.event === "error") {
      const ncpError = parseNcpError(frame.data);
      this.publish({ type: "endpoint.error", payload: ncpError });
      throw ncpErrorToError(ncpError, { alreadyPublished: true });
    }
  }
}

export function createNcpHttpAgentClient(options: NcpHttpAgentClientOptions): NcpAgentClientEndpoint {
  return new NcpHttpAgentClientEndpoint(options);
}
