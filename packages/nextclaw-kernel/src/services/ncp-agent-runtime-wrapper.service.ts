import { buildOpenAiFunctionTool } from "@nextclaw/ncp-agent-runtime";
import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
  NcpAgentRuntime,
  NcpEndpointEvent,
  NcpMessage,
  NcpTool,
  OpenAITool,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import type {
  AgentRuntime,
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
    const { sessionRun, tools } = options;
    this.currentTools = tools.map(this.toOpenAiTool);
    const messages = sessionRun.inbox.drain();
    try {
      for (const event of this.toMessageSentEvents(messages, spec, sessionRun.sessionId)) {
        yield await this.applyEvent(sessionRun, event);
      }
      const input: NcpAgentRunInput & { runId?: string } = {
        sessionId: sessionRun.sessionId,
        runId: spec.runId,
        messages,
        correlationId: spec.correlationId,
        metadata: this.buildMetadata(options.session, spec),
        executionContext: {
          cwd: options.session.workingDir,
        },
      };
      for await (const event of this.getRuntime().run(input, { signal: options.signal })) {
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

  private toMessageSentEvents = (
    messages: readonly NcpMessage[],
    spec: AgentRunSpec,
    sessionId: string,
  ): NcpEndpointEvent[] =>
    messages.map((message) => ({
      occurredAt: new Date().toISOString(),
      type: NcpEventType.MessageSent,
      payload: {
        sessionId,
        message,
        correlationId: spec.correlationId,
      },
    }));

  private buildMetadata = (session: AgentRunSession, spec: AgentRunSpec): Record<string, unknown> => ({
    ...session.metadata,
    agentId: spec.agentId,
    agentRuntimeId: session.agentRuntimeId,
    maxTokens: spec.maxTokens,
    model: spec.model,
    preferred_model: spec.model,
    thinkingEffort: spec.thinkingEffort,
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
