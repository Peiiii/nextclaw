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
    publishToolResult: (event: NcpEndpointEvent) => Promise<void>,
  ): Promise<NcpEndpointEvent>;
  toRunErrorEvent(error: unknown): NcpEndpointEvent;
};

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
  private isRunningTool = false;
  private isCanceled = false;
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
    this.isRunningTool || this.readyToolCalls.length > 0 || this.queue.hasBuffered();

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
    if (this.isRunningTool || this.isCanceled) return;
    this.isRunningTool = true;
    void this.runReadyToolCalls().finally(() => {
      this.isRunningTool = false;
      if (!this.isCanceled && this.readyToolCalls.length > 0) {
        this.drainReadyToolCalls();
      }
    });
  };

  private runReadyToolCalls = async (): Promise<void> => {
    while (!this.isCanceled && this.readyToolCalls.length > 0) {
      const toolCall = this.readyToolCalls.shift();
      if (toolCall) {
        await this.runToolCall(toolCall);
      }
    }
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
