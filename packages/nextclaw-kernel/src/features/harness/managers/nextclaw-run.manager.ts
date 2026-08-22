import type { DirectPromptDispatchExecution } from "@kernel/features/ncp-dispatch/index.js";
import {
  NextclawHarnessError,
  type INextclawRun,
  type NextclawRunStatus,
  type NextclawTaskResult,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";
import type { NcpEndpointEvent } from "@nextclaw/ncp";

async function* emptyEvents(): AsyncGenerator<NcpEndpointEvent> {}

export class NextclawRun implements INextclawRun {
  readonly agentId: string;
  readonly runId: string | null;
  readonly sessionId: string;
  private currentStatus: NextclawRunStatus;
  private cancellationRequested = false;
  private readonly resultPromise: Promise<NextclawTaskResult>;
  private readonly onAbort = (): void => {
    this.cancellationRequested = true;
  };

  constructor(
    private readonly execution: DirectPromptDispatchExecution,
    private readonly onSettled?: (run: NextclawRun) => void,
    signal?: AbortSignal,
  ) {
    signal?.addEventListener("abort", this.onAbort, { once: true });
    if (execution.kind === "command") {
      this.agentId = execution.result.agentId;
      this.runId = null;
      this.sessionId = execution.result.sessionId;
      this.currentStatus = "completed";
      this.resultPromise = Promise.resolve({
        schemaVersion: "nextclaw.task/v1",
        status: "completed",
        ...execution.result,
      });
      queueMicrotask(() => {
        signal?.removeEventListener("abort", this.onAbort);
        this.onSettled?.(this);
      });
      return;
    }
    this.agentId = execution.agentId;
    this.runId = execution.execution.handle.runId;
    this.sessionId = execution.sessionId;
    this.currentStatus = "running";
    this.resultPromise = execution.execution.result
      .then((result) => {
        this.currentStatus = "completed";
        return {
          schemaVersion: "nextclaw.task/v1" as const,
          status: "completed" as const,
          kind: "agent" as const,
          agentId: execution.agentId,
          sessionId: result.handle.sessionId,
          runId: result.handle.runId,
          text: result.text,
          completedMessage: result.completedMessage,
        };
      })
      .catch((error: unknown) => {
        const cancelled =
          this.cancellationRequested ||
          (error instanceof DOMException && error.name === "AbortError");
        this.currentStatus = cancelled ? "cancelled" : "failed";
        if (error instanceof NextclawHarnessError) {
          throw error;
        }
        throw new NextclawHarnessError(
          cancelled ? "cancelled" : "runtime_failure",
          cancelled
            ? "Task was cancelled."
            : error instanceof Error
              ? error.message
              : String(error),
          error,
        );
      })
      .finally(() => {
        signal?.removeEventListener("abort", this.onAbort);
        this.onSettled?.(this);
      });
    void this.resultPromise.catch(() => undefined);
  }

  get status(): NextclawRunStatus {
    return this.currentStatus;
  }

  events = (): AsyncIterable<NcpEndpointEvent> =>
    this.execution.kind === "agent"
      ? this.execution.execution.events
      : emptyEvents();

  result = async (): Promise<NextclawTaskResult> => await this.resultPromise;

  cancel = async (): Promise<void> => {
    if (this.execution.kind !== "agent" || this.currentStatus !== "running") {
      return;
    }
    this.cancellationRequested = true;
    await this.execution.execution.cancel();
  };

  dispose = (): void => {
    if (this.execution.kind !== "agent" || this.currentStatus !== "running") {
      return;
    }
    this.cancellationRequested = true;
    this.execution.execution.dispose();
  };
}
