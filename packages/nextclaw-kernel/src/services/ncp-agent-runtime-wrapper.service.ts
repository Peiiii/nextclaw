import { buildOpenAiFunctionTool } from "@nextclaw/ncp-agent-runtime";
import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
  NcpAgentRuntime,
  NcpEndpointEvent,
  NcpTool,
  OpenAITool,
} from "@nextclaw/ncp";
import {
  createUnavailableNcpAiExecutionMetadata,
  NCP_AI_EXECUTION_METADATA_KEY,
  NcpEventType,
  readNcpAiExecutionMetadata,
  type NcpAiExecutionOutcome,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import type {
  AgentRuntime,
  AgentRuntimeContextCompactionOptions,
  AgentRuntimeRunOptions,
} from "@kernel/managers/agent-runtime.manager.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import type { AgentRunSpec } from "@kernel/types/agent-run.types.js";

export type NcpAgentRuntimeWrapperParams = {
  createRuntime: (params: {
    resolveTools: (input: NcpAgentRunInput) => ReadonlyArray<OpenAITool> | undefined;
    stateManager: NcpAgentConversationStateManager;
  }) => NcpAgentRuntime;
};

export class NcpAgentRuntimeWrapper implements AgentRuntime {
  private readonly stateManager = new DefaultNcpAgentConversationStateManager();
  private runtime: NcpAgentRuntime | null = null;
  private currentTools: ReadonlyArray<OpenAITool> = [];

  constructor(private readonly params: NcpAgentRuntimeWrapperParams) {}

  run = async function* (
    this: NcpAgentRuntimeWrapper,
    spec: AgentRunSpec,
    options: AgentRuntimeRunOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    const { session, sessionRun, signal, tools } = options;
    this.currentTools = tools.map(this.toOpenAiTool);
    const messages = sessionRun.inbox.drain();
    let executionMetadataSeen = false;
    try {
      const input: NcpAgentRunInput & { runId?: string } = {
        sessionId: sessionRun.sessionId,
        runId: spec.runId,
        messages,
        correlationId: spec.correlationId,
        metadata: this.buildMetadata(session, spec),
        executionContext: {
          cwd: session.workingDir,
        },
      };
      for await (const event of this.getRuntime().run(input, { signal })) {
        if (
          event.type === NcpEventType.RunMetadata &&
          readNcpAiExecutionMetadata(event.payload.metadata)
        ) {
          executionMetadataSeen = true;
        }
        const terminalOutcome = this.readTerminalOutcome(event);
        if (terminalOutcome && !executionMetadataSeen) {
          yield await this.applyEvent(
            sessionRun,
            this.createExecutionMetadataEvent(spec, session, event, terminalOutcome),
          );
          executionMetadataSeen = true;
        }
        yield await this.applyEvent(sessionRun, event);
      }
    } finally {
      this.currentTools = [];
    }
  };

  dispose = async (): Promise<void> => {
    await this.disposeRuntimeInstance();
    this.currentTools = [];
  };

  compactContext = async (
    options: AgentRuntimeContextCompactionOptions,
  ) => {
    const runtime = this.getRuntime();
    if (!runtime.compactContext) {
      return { events: [], performed: false, supported: false };
    }
    await runtime.compactContext({ sessionId: options.sessionRun.sessionId });
    return { events: [], performed: true, supported: true };
  };

  private disposeRuntimeInstance = async (): Promise<void> => {
    if (this.runtime && "dispose" in this.runtime && typeof this.runtime.dispose === "function") {
      await this.runtime.dispose();
    }
    this.runtime = null;
  };

  private getRuntime = (): NcpAgentRuntime => {
    if (!this.runtime) {
      this.runtime = this.params.createRuntime({
        resolveTools: () => this.currentTools,
        stateManager: this.stateManager,
      });
    }
    return this.runtime;
  };

  private buildMetadata = (session: AgentRunSession, spec: AgentRunSpec): Record<string, unknown> => ({
    ...session.metadata,
    agentId: spec.agentId,
    agentRuntimeId: session.agentRuntimeId,
    maxTokens: spec.maxTokens,
    model: spec.model,
    preferred_model: spec.model,
    thinkingEffort: spec.thinkingEffort,
  });

  private readTerminalOutcome = (event: NcpEndpointEvent): NcpAiExecutionOutcome | null => {
    if (event.type === NcpEventType.RunFinished) return "completed";
    if (event.type === NcpEventType.RunError) return "failed";
    if (event.type === NcpEventType.MessageAbort) return "aborted";
    return null;
  };

  private createExecutionMetadataEvent = (
    spec: AgentRunSpec,
    session: AgentRunSession,
    terminalEvent: NcpEndpointEvent,
    outcome: NcpAiExecutionOutcome,
  ): NcpEndpointEvent => ({
    occurredAt: terminalEvent.occurredAt ?? new Date().toISOString(),
    type: NcpEventType.RunMetadata,
    payload: {
      runId: spec.runId,
      sessionId: session.sessionId,
      correlationId: spec.correlationId,
      metadata: {
        [NCP_AI_EXECUTION_METADATA_KEY]: createUnavailableNcpAiExecutionMetadata({
          runId: spec.runId,
          runtimeId: spec.runtimeId,
          model: spec.model,
          requestedModel: spec.requestedModel,
          outcome,
        }),
      },
    },
  });

  private toOpenAiTool = (tool: NcpTool): OpenAITool =>
    buildOpenAiFunctionTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    });

  private applyEvent = async (
    sessionRun: AgentRuntimeRunOptions["sessionRun"],
    event: NcpEndpointEvent,
  ): Promise<NcpEndpointEvent> => {
    await sessionRun.applyEvents([event]);
    return event;
  };

}
