import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";

export type RuntimeQueuedEvent = {
  event: NcpEndpointEvent;
  resolveApplied(): void;
  rejectApplied(error: unknown): void;
};

type RuntimeEventQueueWaiter = {
  resolve(item: RuntimeQueuedEvent): void;
  reject(error: unknown): void;
};

type RuntimeToolCallDraft = CollectedToolCall & {
  ended: boolean;
};

export type RuntimeToolCallExecutorInput = {
  executeToolCall(
    toolCall: CollectedToolCall,
    publishToolEvent: (event: NcpEndpointEvent) => Promise<void>,
  ): Promise<NcpEndpointEvent>;
  supportsParallelToolCalls(toolCall: CollectedToolCall): boolean;
  toRunErrorEvent(error: unknown): NcpEndpointEvent;
  toolIterationBudget: RuntimeToolIterationBudget;
};

const MAX_PARALLEL_TOOL_CALLS = 8;

export class RuntimeToolIterationLimitError extends Error {
  constructor(
    readonly limit: number,
    readonly startedToolCount: number,
  ) {
    super(
      `Tool iteration limit reached: configured maximum ${limit}; ${startedToolCount} tool calls already started.`,
    );
    this.name = "RuntimeToolIterationLimitError";
  }
}

export class RuntimeToolIterationBudget {
  private startedToolCount = 0;

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`maxToolIterations must be a positive integer; received ${limit}.`);
    }
  }

  consume = (): void => {
    if (this.startedToolCount >= this.limit) {
      throw new RuntimeToolIterationLimitError(this.limit, this.startedToolCount);
    }
    this.startedToolCount += 1;
  };

  getStartedToolCount = (): number => this.startedToolCount;
}

class RuntimeEventQueue {
  private readonly buffered: RuntimeQueuedEvent[] = [];
  private readonly waiters: RuntimeEventQueueWaiter[] = [];
  private closedError: unknown;

  pushAndWait = (event: NcpEndpointEvent): Promise<void> => {
    if (this.closedError) {
      return Promise.reject(this.closedError);
    }
    return new Promise((resolveApplied, rejectApplied) => {
      const item: RuntimeQueuedEvent = { event, resolveApplied, rejectApplied };
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter.resolve(item);
        return;
      }
      this.buffered.push(item);
    });
  };

  next = (): Promise<RuntimeQueuedEvent> => {
    const item = this.buffered.shift();
    if (item) {
      return Promise.resolve(item);
    }
    if (this.closedError) {
      return Promise.reject(this.closedError);
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  };

  hasBuffered = (): boolean => this.buffered.length > 0;

  close = (error: unknown): void => {
    if (this.closedError) return;
    this.closedError = error;
    for (const item of this.buffered.splice(0)) item.rejectApplied(error);
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  };
}

export class RuntimeToolCallExecutor {
  private readonly calls = new Map<string, RuntimeToolCallDraft>();
  private readonly queue = new RuntimeEventQueue();
  private readonly readyToolCalls: CollectedToolCall[] = [];
  private isCanceled = false;
  private isRunningExclusiveTool = false;
  private runningParallelToolCount = 0;
  private startedToolCount = 0;

  constructor(private readonly input: RuntimeToolCallExecutorInput) {}

  acceptEvent = (event: NcpEndpointEvent): void => {
    switch (event.type) {
      case NcpEventType.MessageToolCallStart:
        this.calls.set(event.payload.toolCallId, {
          args: "",
          ended: false,
          toolCallId: event.payload.toolCallId,
          toolName: event.payload.toolName,
        });
        return;
      case NcpEventType.MessageToolCallArgs:
        this.updateArgs(event.payload.toolCallId, event.payload.args);
        return;
      case NcpEventType.MessageToolCallArgsDelta:
        this.appendArgs(event.payload.toolCallId, event.payload.delta);
        return;
      case NcpEventType.MessageToolCallEnd:
        this.startToolCall(event.payload.toolCallId);
        return;
      default:
        return;
    }
  };

  hasPendingEvents = (): boolean =>
    this.hasRunningToolCalls() || this.readyToolCalls.length > 0 || this.queue.hasBuffered();

  hasStartedToolCalls = (): boolean => this.startedToolCount > 0;

  nextEvent = (): Promise<RuntimeQueuedEvent> => this.queue.next();

  cancel = (error: unknown): void => {
    this.isCanceled = true;
    this.readyToolCalls.length = 0;
    this.queue.close(error);
  };

  private updateArgs = (toolCallId: string, args: string): void => {
    const call = this.calls.get(toolCallId);
    if (call && !call.ended) call.args = args;
  };

  private appendArgs = (toolCallId: string, delta: string): void => {
    const call = this.calls.get(toolCallId);
    if (call && !call.ended) call.args += delta;
  };

  private startToolCall = (toolCallId: string): void => {
    const call = this.calls.get(toolCallId);
    if (!call || call.ended || this.isCanceled) return;
    try {
      this.input.toolIterationBudget.consume();
    } catch (error) {
      this.cancel(error);
      throw error;
    }
    call.ended = true;
    this.startedToolCount += 1;
    this.readyToolCalls.push({
      args: call.args,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
    });
    this.drainReadyToolCalls();
  };

  private drainReadyToolCalls = (): void => {
    if (this.isCanceled || this.isRunningExclusiveTool) return;

    while (this.readyToolCalls.length > 0) {
      const toolCall = this.readyToolCalls[0];
      if (!toolCall) return;
      if (!this.input.supportsParallelToolCalls(toolCall)) {
        if (this.runningParallelToolCount > 0) return;
        this.readyToolCalls.shift();
        this.runExclusiveToolCall(toolCall);
        return;
      }
      if (this.runningParallelToolCount >= MAX_PARALLEL_TOOL_CALLS) return;
      this.readyToolCalls.shift();
      this.runParallelToolCall(toolCall);
    }
  };

  private hasRunningToolCalls = (): boolean =>
    this.isRunningExclusiveTool || this.runningParallelToolCount > 0;

  private runExclusiveToolCall = (toolCall: CollectedToolCall): void => {
    this.isRunningExclusiveTool = true;
    void this.runToolCall(toolCall).finally(() => {
      this.isRunningExclusiveTool = false;
      this.drainReadyToolCalls();
    });
  };

  private runParallelToolCall = (toolCall: CollectedToolCall): void => {
    this.runningParallelToolCount += 1;
    void this.runToolCall(toolCall).finally(() => {
      this.runningParallelToolCount -= 1;
      this.drainReadyToolCalls();
    });
  };

  private runToolCall = async (toolCall: CollectedToolCall): Promise<void> => {
    try {
      const resultEvent = await this.input.executeToolCall(toolCall, this.queue.pushAndWait);
      await this.queue.pushAndWait(resultEvent);
    } catch (error) {
      await this.queue.pushAndWait(this.input.toRunErrorEvent(error)).catch(() => undefined);
    }
  };
}
