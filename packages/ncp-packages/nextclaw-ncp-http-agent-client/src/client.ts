import {
  createNcpEndpointEvent as createClientEvent,
  type NcpAgentClientEndpoint,
  type NcpAgentStreamObserver,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRunHandle,
  type NcpStreamRequestPayload,
  NcpEventType,
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
  streamOpenTimeoutMs?: number;
  streamIdleTimeoutMs?: number;
};

type StreamRequestOptions = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
};

function normalizeTimeoutMs(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null;
}

export class NcpHttpAgentClientEndpoint implements NcpAgentClientEndpoint {
  readonly manifest: NcpEndpointManifest;

  private readonly baseUrl: URL;
  private readonly basePath: string;
  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Record<string, string>;
  private readonly streamOpenTimeoutMs: number | null;
  private readonly streamIdleTimeoutMs: number | null;
  private readonly subscribers = new Set<NcpEndpointSubscriber>();
  private readonly activeControllers = new Set<AbortController>();
  private started = false;

  constructor(options: NcpHttpAgentClientOptions) {
    const {
      basePath,
      baseUrl,
      endpointId,
      fetchImpl,
      headers,
      streamIdleTimeoutMs,
      streamOpenTimeoutMs,
    } = options;
    this.baseUrl = toBaseUrl(baseUrl);
    this.basePath = normalizeBasePath(basePath);
    this.fetchImpl = resolveFetchImpl(fetchImpl);
    this.defaultHeaders = headers ?? {};
    this.streamOpenTimeoutMs = normalizeTimeoutMs(streamOpenTimeoutMs);
    this.streamIdleTimeoutMs = normalizeTimeoutMs(streamIdleTimeoutMs);
    this.manifest = {
      endpointKind: "custom",
      endpointId: endpointId?.trim() || DEFAULT_ENDPOINT_ID,
      version: "0.1.0",
      supportsStreaming: true,
      supportsAbort: true,
      supportsProactiveMessages: false,
      supportsLiveSessionStream: true,
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
    this.publish(createClientEvent({ type: NcpEventType.EndpointReady }));
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
      case "message.stream-request":
        await this.stream(event.payload);
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

  async send(envelope: NcpAgentSendEnvelope): Promise<NcpRunHandle> {
    await this.ensureStarted();
    const controller = new AbortController();
    this.activeControllers.add(controller);
    try {
      const response = await this.fetchImpl(this.resolveUrl("/send"), {
        method: "POST",
        headers: {
          ...this.defaultHeaders,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `NCP send command failed with HTTP ${response.status}: ${await safeReadText(response)}`,
        );
      }
      const payload = await response.json() as { ok?: boolean; data?: NcpRunHandle; error?: { message?: string } };
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "NCP send command returned an invalid handle.");
      }
      return payload.data;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("NCP send command was cancelled.");
      }
      if (isNcpHttpAgentClientError(error)) {
        throw error;
      }
      const ncpError = toNcpError(error);
      this.publish(createClientEvent({ type: NcpEventType.EndpointError, payload: ncpError }));
      throw ncpErrorToError(ncpError);
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  async stream(
    payload: NcpStreamRequestPayload,
    observer?: NcpAgentStreamObserver,
  ): Promise<void> {
    await this.ensureStarted();
    const query = new URLSearchParams({
      sessionId: payload.sessionId,
    });
    await this.streamRequest({
      path: `/stream?${query.toString()}`,
      method: "GET",
    }, observer);
  }

  async abort(payload: NcpMessageAbortPayload): Promise<void> {
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
      this.publish(createClientEvent({ type: NcpEventType.EndpointError, payload: ncpError }));
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

  private async streamRequest(
    options: StreamRequestOptions,
    observer?: NcpAgentStreamObserver,
  ): Promise<void> {
    const { body, method, path } = options;
    const controller = new AbortController();
    this.activeControllers.add(controller);
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let timeoutError: { code: "timeout-error"; message: string } | null = null;
    const clearTimeoutTimer = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
    const armTimeout = (timeoutMs: number | null, message: string) => {
      clearTimeoutTimer();
      if (!timeoutMs) {
        return;
      }
      timeout = setTimeout(() => {
        timeoutError = { code: "timeout-error", message };
        controller.abort(timeoutError);
      }, timeoutMs);
    };

    try {
      armTimeout(
        this.streamOpenTimeoutMs,
        `NCP stream did not open within ${this.streamOpenTimeoutMs}ms.`,
      );
      const response = await this.fetchImpl(this.resolveUrl(path), {
        method,
        headers: {
          ...this.defaultHeaders,
          accept: "text/event-stream",
          ...(body !== undefined
            ? { "content-type": "application/json" }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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

      observer?.onOpen?.();
      armTimeout(
        this.streamIdleTimeoutMs,
        `NCP stream received no data for ${this.streamIdleTimeoutMs}ms.`,
      );
      for await (const frame of consumeSseStream(response.body, {
        onActivity: () => {
          armTimeout(
            this.streamIdleTimeoutMs,
            `NCP stream received no data for ${this.streamIdleTimeoutMs}ms.`,
          );
        },
      })) {
        if (controller.signal.aborted) {
          return;
        }
        this.handleSseFrame(frame);
      }
    } catch (error) {
      if (controller.signal.aborted && !timeoutError) {
        return;
      }
      if (isNcpHttpAgentClientError(error)) {
        throw error;
      }
      const ncpError = timeoutError ?? toNcpError(error);
      this.publish(createClientEvent({ type: NcpEventType.EndpointError, payload: ncpError }));
      throw ncpErrorToError(ncpError);
    } finally {
      clearTimeoutTimer();
      this.activeControllers.delete(controller);
    }
  }

  private handleSseFrame(frame: { event: string; data: string }): void {
    if (frame.event === "ncp-event") {
      const event = parseNcpEvent(frame.data);
      if (!event) {
        this.publish(createClientEvent({
          type: NcpEventType.EndpointError,
          payload: {
            code: "runtime-error",
            message: "Received malformed ncp-event frame.",
          },
        }));
        return;
      }
      this.publish(event);
      return;
    }

    if (frame.event === "error") {
      const ncpError = parseNcpError(frame.data);
      this.publish(createClientEvent({ type: NcpEventType.EndpointError, payload: ncpError }));
      throw ncpErrorToError(ncpError, { alreadyPublished: true });
    }
  }
}
