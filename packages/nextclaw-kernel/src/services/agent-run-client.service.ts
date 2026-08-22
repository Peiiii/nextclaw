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

export type AgentRunExecution = {
  handle: NcpRunHandle;
  events: AsyncIterable<NcpEndpointEvent>;
  result: Promise<AgentRunReply>;
  cancel: () => Promise<void>;
  dispose: () => void;
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
    event.type === NcpEventType.MessageAbort ||
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
  private readonly resultPromise: Promise<NcpMessage>;
  private readonly unsubscribe: () => void;
  private abortCleanup?: () => void;
  private completedMessage?: NcpMessage;
  private disposed = false;
  private rejectResult!: (error: Error) => void;
  private resolveResult!: (message: NcpMessage) => void;
  private runId?: string;
  private sessionId?: string;
  private settled = false;

  constructor(
    private readonly options: {
      abortSignal?: AbortSignal;
      correlationId: string;
      eventBus: Pick<EventBus, "on">;
      ingress: Pick<Ingress, "handle">;
      missingCompletedMessageError?: string;
      onAssistantDelta?: (delta: string) => void;
      onEvent?: (event: NcpEndpointEvent) => void;
      runErrorMessage?: string;
    },
  ) {
    this.resultPromise = new Promise<NcpMessage>((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });
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

  waitForReply = async (): Promise<NcpMessage> => await this.resultPromise;

  cancel = async (): Promise<void> => {
    if (!this.sessionId) {
      return;
    }
    await this.options.ingress.handle(
      {
        type: ingressKeys.agentRun.abort,
        payload: {
          sessionId: this.sessionId,
          correlationId: this.options.correlationId,
        },
      },
      { source: "agent-run-client" },
    );
  };

  dispose = (error?: Error): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.abortCleanup?.();
    this.unsubscribe();
    this.queue.close();
    if (!this.settled) {
      this.settled = true;
      this.rejectResult(
        error ?? new Error("NCP run observation ended before a terminal event."),
      );
    }
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
    if (event.type === NcpEventType.MessageTextDelta) {
      this.options.onAssistantDelta?.(event.payload.delta);
    } else if (event.type === NcpEventType.MessageCompleted) {
      this.completedMessage = event.payload.message;
    } else if (event.type === NcpEventType.MessageAbort) {
      this.rejectWith(new DOMException("NCP run was cancelled.", "AbortError"));
    } else if (event.type === NcpEventType.MessageFailed) {
      this.rejectWith(new Error(event.payload.error.message));
    } else if (event.type === NcpEventType.RunError) {
      this.rejectWith(
        new Error(
          event.payload.error ??
            this.options.runErrorMessage ??
            "NCP run failed.",
        ),
      );
    } else if (event.type === NcpEventType.RunFinished) {
      if (this.completedMessage) {
        this.resolveWith(this.completedMessage);
      } else {
        this.rejectWith(
          new Error(
            this.options.missingCompletedMessageError ??
              "NCP run completed without a final assistant message.",
          ),
        );
      }
    }
    if (isTerminalEvent(event)) {
      this.queue.close();
    }
  };

  private rejectWith = (error: Error): void => {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.rejectResult(error);
  };

  private resolveWith = (message: NcpMessage): void => {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.resolveResult(message);
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
    return await (await this.startRun(input, options)).result;
  };

  startRun = async (
    input: AgentRunSendIngressPayload,
    options: AgentRunReplyOptions = {},
  ): Promise<AgentRunExecution> => {
    const correlationId = randomUUID();
    const observer = this.prepareObserver(correlationId, options);
    let handle: NcpRunHandle;
    try {
      handle = await this.sendWithCorrelation(input, correlationId);
      observer.attachHandle(handle);
    } catch (error) {
      observer.dispose(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
    const result = observer
      .waitForReply()
      .then((completedMessage) => ({
        handle,
        completedMessage,
        text: extractTextFromNcpMessage(completedMessage),
      }))
      .finally(observer.dispose);
    void result.catch(() => undefined);
    return {
      handle,
      events: { [Symbol.asyncIterator]: () => observer.stream() },
      result,
      cancel: observer.cancel,
      dispose: observer.dispose,
    };
  };

  sendAndStreamEvents = async function* (
    this: AgentRunClient,
    input: AgentRunSendIngressPayload,
    options: AgentRunStreamOptions = {},
  ): AsyncGenerator<NcpEndpointEvent> {
    const execution = await this.startRun(input, options);
    try {
      for await (const event of execution.events) {
        yield event;
      }
    } finally {
      execution.dispose();
    }
  };

  private prepareObserver = (
    correlationId: string,
    options: AgentRunReplyOptions | AgentRunStreamOptions,
  ): AgentRunObserver => {
    const { abortSignal, onEvent } = options;
    const missingCompletedMessageError =
      "missingCompletedMessageError" in options
        ? options.missingCompletedMessageError
        : undefined;
    const onAssistantDelta =
      "onAssistantDelta" in options ? options.onAssistantDelta : undefined;
    const runErrorMessage =
      "runErrorMessage" in options ? options.runErrorMessage : undefined;
    return new AgentRunObserver({
      abortSignal,
      correlationId,
      eventBus: this.options.eventBus,
      ingress: this.options.ingress,
      missingCompletedMessageError,
      onAssistantDelta,
      onEvent,
      runErrorMessage,
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
