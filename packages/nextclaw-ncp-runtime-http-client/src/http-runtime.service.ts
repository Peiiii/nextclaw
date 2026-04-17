import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import {
  type NcpAgentConversationStateManager,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
  type NcpProviderRuntimeRoute,
  type OpenAITool,
} from "@nextclaw/ncp";
import type { HttpRuntimeFetchLike } from "./http-runtime-config.utils.js";

export type HttpRuntimeNcpAgentRuntimeConfig = {
  baseUrl: string;
  basePath?: string;
  endpointId?: string;
  headers?: Record<string, string>;
  fetchImpl?: HttpRuntimeFetchLike;
  stateManager?: NcpAgentConversationStateManager;
  resolveTools?: (input: NcpAgentRunInput) => ReadonlyArray<OpenAITool> | undefined;
  resolveProviderRoute?: (input: NcpAgentRunInput) => NcpProviderRuntimeRoute | undefined;
};

function readEventSessionId(event: NcpEndpointEvent): string | null {
  if (!("payload" in event)) {
    return null;
  }
  const payload = event.payload;
  if (!payload || typeof payload !== "object" || !("sessionId" in payload)) {
    return null;
  }
  return typeof payload.sessionId === "string" ? payload.sessionId : null;
}

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  const message =
    typeof reason === "string" && reason.trim().length > 0
      ? reason.trim()
      : "operation aborted";
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

class HttpRuntimeEventBuffer {
  private readonly events: NcpEndpointEvent[] = [];
  private waiters = new Set<() => void>();

  push = (event: NcpEndpointEvent): void => {
    this.events.push(event);
    this.flushWaiters();
  };

  shift = (): NcpEndpointEvent | undefined => this.events.shift();

  hasEvents = (): boolean => this.events.length > 0;

  waitForChange = async (): Promise<void> => {
    if (this.events.length > 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.add(resolve);
    });
  };

  notify = (): void => {
    this.flushWaiters();
  };

  private flushWaiters = (): void => {
    if (this.waiters.size === 0) {
      return;
    }
    const waiters = [...this.waiters];
    this.waiters.clear();
    for (const waiter of waiters) {
      waiter();
    }
  };
}

class HttpRuntimeRunController {
  private readonly buffer = new HttpRuntimeEventBuffer();
  private streamSettled = false;
  private streamError: Error | null = null;
  private stopRequested = false;
  private abortRequested = false;
  private terminalEventSeen = false;
  private readonly resolvedTools: ReadonlyArray<OpenAITool>;
  private readonly resolvedProviderRoute: NcpProviderRuntimeRoute | undefined;

  constructor(
    private readonly endpoint: NcpHttpAgentClientEndpoint,
    private readonly input: NcpAgentRunInput,
    private readonly stateManager?: NcpAgentConversationStateManager,
    private readonly resolveTools?: (input: NcpAgentRunInput) => ReadonlyArray<OpenAITool> | undefined,
    private readonly resolveProviderRoute?: (input: NcpAgentRunInput) => NcpProviderRuntimeRoute | undefined,
  ) {
    this.resolvedTools = resolveTools?.(input) ?? [];
    this.resolvedProviderRoute = resolveProviderRoute?.(input);
  }

  execute = async function* (
    this: HttpRuntimeRunController,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const requestMessage = this.input.messages.at(-1);
    if (!requestMessage) {
      throw new Error("[http-runtime] runtime.run requires at least one input message.");
    }

    const unsubscribe = this.endpoint.subscribe(this.handleEndpointEvent);
    const releaseAbort = this.bindAbortSignal(options?.signal);
    const streamPromise = this.startStream();

    try {
      await Promise.resolve();
      await this.endpoint.send({
        sessionId: this.input.sessionId,
        message: requestMessage,
        ...(this.input.correlationId ? { correlationId: this.input.correlationId } : {}),
        ...(this.input.metadata ? { metadata: this.input.metadata } : {}),
        ...(this.resolvedProviderRoute ? { providerRoute: this.resolvedProviderRoute } : {}),
        ...(this.resolvedTools.length > 0 ? { tools: this.resolvedTools } : {}),
      });

      while (!this.streamSettled || this.buffer.hasEvents()) {
        const event = this.buffer.shift();
        if (!event) {
          if (this.streamError) {
            throw this.streamError;
          }
          await this.buffer.waitForChange();
          continue;
        }

        yield* this.emitEvent(event);

        if (this.isTerminalEvent(event) && !this.stopRequested) {
          // Let the remote SSE stream close naturally after terminal events.
          // Aborting a fetch body mid-consumption can leave the stream promise
          // unsettled in Node, which keeps the whole run stuck in "running".
          this.terminalEventSeen = true;
        }
      }

      if (this.streamError) {
        throw this.streamError;
      }
      if (options?.signal?.aborted || this.abortRequested) {
        throw toAbortError(options?.signal?.reason);
      }
    } finally {
      releaseAbort();
      unsubscribe();
      if (!this.terminalEventSeen || this.abortRequested || options?.signal?.aborted) {
        this.stopRequested = true;
        await this.endpoint.stop();
      }
      await streamPromise;
      this.stopRequested = true;
      await this.endpoint.stop();
    }
  };

  private startStream = async (): Promise<void> => {
    try {
      await this.endpoint.stream({
        sessionId: this.input.sessionId,
        ...(this.input.metadata ? { metadata: this.input.metadata } : {}),
      });
    } catch (error) {
      if (this.stopRequested || this.abortRequested) {
        return;
      }
      this.streamError =
        error instanceof Error ? error : new Error(String(error));
    } finally {
      this.streamSettled = true;
      this.buffer.notify();
    }
  };

  private bindAbortSignal = (signal?: AbortSignal): (() => void) => {
    if (!signal) {
      return () => undefined;
    }

    const handleAbort = (): void => {
      this.abortRequested = true;
      void this.abortRemoteRun();
    };

    if (signal.aborted) {
      handleAbort();
      return () => undefined;
    }

    signal.addEventListener("abort", handleAbort, { once: true });
    return () => {
      signal.removeEventListener("abort", handleAbort);
    };
  };

  private abortRemoteRun = async (): Promise<void> => {
    try {
      await this.endpoint.abort({
        sessionId: this.input.sessionId,
      });
    } catch {
      // Best effort: the local session should still stop waiting even if the remote abort fails.
    } finally {
      this.stopRequested = true;
      await this.endpoint.stop();
      this.buffer.notify();
    }
  };

  private handleEndpointEvent = (event: NcpEndpointEvent): void => {
    if (event.type === NcpEventType.EndpointReady) {
      return;
    }

    const sessionId = readEventSessionId(event);
    if (sessionId && sessionId !== this.input.sessionId) {
      return;
    }

    this.buffer.push(event);
  };

  private emitEvent = async function* (
    this: HttpRuntimeRunController,
    event: NcpEndpointEvent,
  ): AsyncGenerator<NcpEndpointEvent> {
    await this.stateManager?.dispatch(event);
    yield event;
  };

  private isTerminalEvent = (event: NcpEndpointEvent): boolean =>
    event.type === NcpEventType.RunFinished ||
    event.type === NcpEventType.RunError ||
    event.type === NcpEventType.MessageFailed;
}

export class HttpRuntimeNcpAgentRuntime implements NcpAgentRuntime {
  private readonly endpoint: NcpHttpAgentClientEndpoint;

  constructor(private readonly config: HttpRuntimeNcpAgentRuntimeConfig) {
    this.endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: config.baseUrl,
      ...(config.basePath ? { basePath: config.basePath } : {}),
      ...(config.endpointId ? { endpointId: config.endpointId } : {}),
      ...(config.headers ? { headers: config.headers } : {}),
      ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    });
  }

  run = async function* (
    this: HttpRuntimeNcpAgentRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const controller = new HttpRuntimeRunController(
      this.endpoint,
      input,
      this.config.stateManager,
      this.config.resolveTools,
      this.config.resolveProviderRoute,
    );
    yield* controller.execute(options);
  };
}
