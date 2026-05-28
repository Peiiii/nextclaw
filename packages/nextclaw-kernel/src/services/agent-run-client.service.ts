import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import {
  eventKeys,
  ingressKeys,
  type AgentRunSendIngressPayload,
  type EventBus,
  type Ingress,
} from "@nextclaw/shared";
import { randomUUID } from "node:crypto";
import { extractTextFromNcpMessage } from "@kernel/utils/ncp-message-bridge.utils.js";

export type AgentRunReplyOptions = {
  abortSignal?: AbortSignal;
  onAssistantDelta?: (delta: string) => void;
  onEvent?: (event: NcpEndpointEvent) => void;
  missingCompletedMessageError?: string;
  runErrorMessage?: string;
};

export type AgentRunStreamOptions = {
  abortSignal?: AbortSignal;
  onEvent?: (event: NcpEndpointEvent) => void;
};

export type AgentRunReply = {
  handle: NcpRunHandle;
  text: string;
  completedMessage: NcpMessage;
};

function readEventCorrelationId(event: NcpEndpointEvent): string | undefined {
  if (!("payload" in event)) {
    return undefined;
  }
  const correlationId =
    "correlationId" in event.payload ? event.payload.correlationId : undefined;
  return typeof correlationId === "string" && correlationId.length > 0
    ? correlationId
    : undefined;
}

function readEventSessionId(event: NcpEndpointEvent): string | undefined {
  if (!("payload" in event)) {
    return undefined;
  }
  const sessionId =
    "sessionId" in event.payload ? event.payload.sessionId : undefined;
  return typeof sessionId === "string" && sessionId.length > 0
    ? sessionId
    : undefined;
}

function readEventRunId(event: NcpEndpointEvent): string | undefined {
  if (!("payload" in event)) {
    return undefined;
  }
  const runId = "runId" in event.payload ? event.payload.runId : undefined;
  return typeof runId === "string" && runId.length > 0 ? runId : undefined;
}

function isTerminalEvent(event: NcpEndpointEvent): boolean {
  return (
    event.type === NcpEventType.MessageFailed ||
    event.type === NcpEventType.RunError ||
    event.type === NcpEventType.RunFinished
  );
}

function isRunEventMatch(params: {
  correlationId: string;
  event: NcpEndpointEvent;
  runId?: string;
  sessionId?: string;
}): boolean {
  const { correlationId, event, runId, sessionId } = params;
  const eventCorrelationId = readEventCorrelationId(event);
  if (eventCorrelationId) {
    return eventCorrelationId === correlationId;
  }
  if (!sessionId || !runId) {
    return false;
  }
  return (
    readEventSessionId(event) === sessionId && readEventRunId(event) === runId
  );
}

class AgentRunEventQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push = (value: T): void => {
    if (this.closed) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ done: false, value });
      return;
    }
    this.values.push(value);
  };

  close = (): void => {
    if (this.closed) {
      return;
    }
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ done: true, value: undefined as T });
    }
  };

  next = async (): Promise<IteratorResult<T>> => {
    if (this.values.length > 0) {
      return {
        done: false,
        value: this.values.shift() as T,
      };
    }
    if (this.closed) {
      return {
        done: true,
        value: undefined as T,
      };
    }
    return await new Promise<IteratorResult<T>>((resolve) => {
      this.waiters.push(resolve);
    });
  };

  [Symbol.asyncIterator] = (): AsyncIterator<T> => ({
    next: this.next,
  });
}

class AgentRunObserver {
  private readonly queue = new AgentRunEventQueue<NcpEndpointEvent>();
  private readonly unsubscribe: () => void;
  private abortCleanup?: () => void;
  private completedMessage?: NcpMessage;
  private disposed = false;
  private runId?: string;
  private sessionId?: string;

  constructor(
    private readonly options: {
      abortSignal?: AbortSignal;
      correlationId: string;
      eventBus: Pick<EventBus, "on">;
      ingress: Pick<Ingress, "handle">;
      onEvent?: (event: NcpEndpointEvent) => void;
    },
  ) {
    this.unsubscribe = options.eventBus.on(
      eventKeys.ncpEvent,
      this.handleEvent,
    );
  }

  attachHandle = (handle: NcpRunHandle): void => {
    this.sessionId = handle.sessionId;
    this.runId = handle.runId ?? undefined;
    const { abortSignal } = this.options;
    if (!abortSignal) {
      return;
    }
    const abort = (): void => {
      void this.options.ingress.handle(
        {
          type: ingressKeys.agentRun.abort,
          payload: {
            sessionId: handle.sessionId,
            correlationId: this.options.correlationId,
          },
        },
        { source: "agent-run-client" },
      );
    };
    if (abortSignal.aborted) {
      abort();
      return;
    }
    abortSignal.addEventListener("abort", abort, { once: true });
    this.abortCleanup = () => abortSignal.removeEventListener("abort", abort);
  };

  stream = async function* (
    this: AgentRunObserver,
  ): AsyncGenerator<NcpEndpointEvent> {
    for await (const event of this.queue) {
      yield event;
    }
  };

  waitForReply = async (
    options: AgentRunReplyOptions = {},
  ): Promise<NcpMessage> => {
    for await (const event of this.queue) {
      if (event.type === NcpEventType.MessageTextDelta) {
        options.onAssistantDelta?.(event.payload.delta);
        continue;
      }
      if (event.type === NcpEventType.MessageCompleted) {
        this.completedMessage = event.payload.message;
        continue;
      }
      if (event.type === NcpEventType.MessageFailed) {
        throw new Error(event.payload.error.message);
      }
      if (event.type === NcpEventType.RunError) {
        throw new Error(
          event.payload.error ?? options.runErrorMessage ?? "NCP run failed.",
        );
      }
      if (event.type === NcpEventType.RunFinished) {
        if (!this.completedMessage) {
          throw new Error(
            options.missingCompletedMessageError ??
              "NCP run completed without a final assistant message.",
          );
        }
        return this.completedMessage;
      }
    }
    throw new Error(
      options.missingCompletedMessageError ??
        "NCP run completed without a final assistant message.",
    );
  };

  dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.abortCleanup?.();
    this.unsubscribe();
    this.queue.close();
  };

  private handleEvent = (event: NcpEndpointEvent): void => {
    if (
      this.disposed ||
      !isRunEventMatch({
        correlationId: this.options.correlationId,
        event,
        runId: this.runId,
        sessionId: this.sessionId,
      })
    ) {
      return;
    }
    this.options.onEvent?.(event);
    this.queue.push(event);
    if (isTerminalEvent(event)) {
      this.queue.close();
    }
  };
}

export class AgentRunClient {
  constructor(
    private readonly options: {
      eventBus: Pick<EventBus, "on">;
      ingress: Pick<Ingress, "handle">;
    },
  ) {}

  send = async (input: AgentRunSendIngressPayload): Promise<NcpRunHandle> => {
    return await this.sendWithCorrelation(input, randomUUID());
  };

  sendAndWaitForReply = async (
    input: AgentRunSendIngressPayload,
    options: AgentRunReplyOptions = {},
  ): Promise<AgentRunReply> => {
    const correlationId = randomUUID();
    const observer = this.prepareObserver(correlationId, options);
    try {
      const handle = await this.sendWithCorrelation(input, correlationId);
      observer.attachHandle(handle);
      const completedMessage = await observer.waitForReply(options);
      return {
        handle,
        completedMessage,
        text: extractTextFromNcpMessage(completedMessage),
      };
    } finally {
      observer.dispose();
    }
  };

  sendAndStreamEvents = async function* (
    this: AgentRunClient,
    input: AgentRunSendIngressPayload,
    options: AgentRunStreamOptions = {},
  ): AsyncGenerator<NcpEndpointEvent> {
    const correlationId = randomUUID();
    const observer = this.prepareObserver(correlationId, options);
    try {
      const handle = await this.sendWithCorrelation(input, correlationId);
      observer.attachHandle(handle);
      for await (const event of observer.stream()) {
        yield event;
      }
    } finally {
      observer.dispose();
    }
  };

  private prepareObserver = (
    correlationId: string,
    options: AgentRunReplyOptions | AgentRunStreamOptions,
  ): AgentRunObserver => {
    return new AgentRunObserver({
      abortSignal: options.abortSignal,
      correlationId,
      eventBus: this.options.eventBus,
      ingress: this.options.ingress,
      onEvent: options.onEvent,
    });
  };

  private sendWithCorrelation = async (
    input: AgentRunSendIngressPayload,
    correlationId: string,
  ): Promise<NcpRunHandle> => {
    return await this.options.ingress.handle<
      AgentRunSendIngressPayload,
      NcpRunHandle
    >(
      {
        type: ingressKeys.agentRun.send,
        payload: {
          ...input,
          correlationId,
        },
      },
      { source: "agent-run-client" },
    );
  };
}
