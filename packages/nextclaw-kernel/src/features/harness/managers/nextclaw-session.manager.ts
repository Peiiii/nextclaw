import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import {
  startPromptOverNcpExecution,
  type DirectPromptDispatchExecution,
} from "@kernel/features/ncp-dispatch/index.js";
import { NextclawRun } from "@kernel/features/harness/managers/nextclaw-run.manager.js";
import {
  NextclawHarnessError,
  type INextclawAgentSessions,
  type INextclawRun,
  type INextclawSession,
  type INextclawSessionRegistry,
  type NextclawSessionCreateInput,
  type NextclawSessionRunInput,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";

export class NextclawSession implements INextclawSession {
  constructor(
    readonly agentId: string,
    readonly sessionId: string,
    private readonly startExecution: (
      input: NextclawSessionRunInput,
    ) => Promise<DirectPromptDispatchExecution>,
    private readonly onRunCreated?: (run: NextclawRun) => void,
    private readonly onRunSettled?: (run: NextclawRun) => void,
  ) {}

  run = async (input: NextclawSessionRunInput): Promise<INextclawRun> => {
    if (typeof input.input !== "string" || !input.input.trim()) {
      throw new NextclawHarnessError(
        "invalid_input",
        "Task input must not be empty.",
      );
    }
    if (input.signal?.aborted) {
      throw new NextclawHarnessError("cancelled", "Task was cancelled.");
    }
    try {
      const run = new NextclawRun(
        await this.startExecution(input),
        this.onRunSettled,
        input.signal,
      );
      this.onRunCreated?.(run);
      return run;
    } catch (error) {
      if (input.signal?.aborted) {
        throw new NextclawHarnessError(
          "cancelled",
          "Task was cancelled.",
          error,
        );
      }
      if (error instanceof NextclawHarnessError) {
        throw error;
      }
      throw new NextclawHarnessError(
        "runtime_failure",
        error instanceof Error ? error.message : String(error),
        error,
      );
    }
  };
}

export class NextclawSessionRegistry implements INextclawSessionRegistry {
  constructor(
    private readonly requireKernel: () => NextclawKernel,
    private readonly onRunCreated?: (run: NextclawRun) => void,
    private readonly onRunSettled?: (run: NextclawRun) => void,
  ) {}

  forAgent = (agentId: string): INextclawAgentSessions => ({
    create: async (input) => await this.createForAgent(agentId, input),
    resume: async (sessionId) => await this.resumeForAgent(agentId, sessionId),
  });

  resume = async (sessionId: string): Promise<INextclawSession> => {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const kernel = this.requireKernel();
    const session = await kernel.sessionManager.getSession(normalizedSessionId);
    if (!session) {
      throw new NextclawHarnessError(
        "invalid_input",
        `Session was not found: ${normalizedSessionId}`,
      );
    }
    return this.createHandle(
      session.agentId || kernel.agents.getDefaultAgentId(),
      normalizedSessionId,
    );
  };

  private createForAgent = async (
    agentId: string,
    input: NextclawSessionCreateInput,
  ): Promise<INextclawSession> => {
    if (typeof input.task !== "string" || !input.task.trim()) {
      throw new NextclawHarnessError(
        "invalid_input",
        "Session task must not be empty.",
      );
    }
    const created = await this.requireKernel().sessionManager.createSession({
      agentId,
      model: input.model,
      projectRoot: input.workspace,
      sessionId: input.sessionId,
      sourceSessionMetadata: {},
      task: input.task,
      title: input.title,
    });
    return this.createHandle(agentId, created.sessionId);
  };

  private resumeForAgent = async (
    agentId: string,
    sessionId: string,
  ): Promise<INextclawSession> => {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const session = await this.requireKernel().sessionManager.getSession(
      normalizedSessionId,
    );
    if (!session) {
      throw new NextclawHarnessError(
        "invalid_input",
        `Session was not found: ${normalizedSessionId}`,
      );
    }
    if (session.agentId && session.agentId !== agentId) {
      throw new NextclawHarnessError(
        "invalid_input",
        `Session ${normalizedSessionId} belongs to agent ${session.agentId}.`,
      );
    }
    return this.createHandle(agentId, normalizedSessionId);
  };

  private createHandle = (
    agentId: string,
    sessionId: string,
  ): INextclawSession =>
    new NextclawSession(
      agentId,
      sessionId,
      async (input) => {
        const kernel = this.requireKernel();
        return await startPromptOverNcpExecution({
          agentId,
          agentRunClient: new AgentRunClient({
            eventBus: kernel.eventBus,
            ingress: kernel.ingress,
          }),
          abortSignal: input.signal,
          config: kernel.configManager.config,
          content: input.input,
          metadata: input.model?.trim()
            ? { model: input.model.trim() }
            : undefined,
          onAssistantDelta: input.onAssistantDelta,
          onEvent: input.onEvent,
          sessionKey: sessionId,
        });
      },
      this.onRunCreated,
      this.onRunSettled,
    );

  private normalizeSessionId = (sessionId: string): string => {
    const normalized = sessionId.trim();
    if (!normalized) {
      throw new NextclawHarnessError(
        "invalid_input",
        "Session id must not be empty.",
      );
    }
    return normalized;
  };
}
