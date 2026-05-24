import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { ContextWindowSnapshot } from "@nextclaw/core";
import {
  type NcpAgentRunInput,
  type NcpEndpointEvent,
  type NcpMessage,
  NcpEventType,
} from "@nextclaw/ncp";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { LiveSession } from "@kernel/utils/session-run.utils.js";
import {
  ContextCompactionPreflightService,
  type ContextCompactionPreflightResult,
} from "@kernel/features/context-compaction/services/context-compaction-preflight.service.js";

export class ContextWindowPreviewManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    private readonly options: {
      configManager: ConfigManager;
    },
  ) {
    this.preflightService = new ContextCompactionPreflightService({
      configManager: options.configManager,
    });
  }

  preview = (params: {
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): ContextWindowSnapshot | null => {
    const {
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    } = params;
    return this.preflightService.preview({
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    });
  };
}

export class ContextCompactionManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    private readonly options: {
      configManager: ConfigManager;
      providerManager?: LlmProviderRuntime;
      sessionRunManager: SessionRunManager;
    },
  ) {
    this.preflightService = new ContextCompactionPreflightService({
      configManager: options.configManager,
      providerManager: options.providerManager,
    });
  }

  runLivePreflight = async function* (
    this: ContextCompactionManager,
    params: {
      input: NcpAgentRunInput;
      session: LiveSession;
    },
  ): AsyncIterable<NcpEndpointEvent> {
    const sessionRunManager = this.options.sessionRunManager;
    const { input, session } = params;
    const beginResult = this.preflightService.begin({
      inputMessages: input.messages,
      requestMetadata: input.metadata ?? {},
      sessionId: input.sessionId,
      sessionMessages: session.stateManager.getSnapshot().messages,
      ...(session.agentId ? { storedAgentId: session.agentId } : {}),
      storedMetadata: input.metadata ?? {},
    });
    yield* this.applyLivePreflightResult({ input, result: beginResult, session, sessionRunManager });
    if (!beginResult.pendingCompaction) {
      return;
    }
    const finishResult = await this.preflightService.finish(beginResult.pendingCompaction);
    yield* this.applyLivePreflightResult({ input, result: finishResult, session, sessionRunManager });
  };

  private applyLivePreflightResult = async function* (
    this: ContextCompactionManager,
    params: {
      input: NcpAgentRunInput;
      result: ContextCompactionPreflightResult;
      session: LiveSession;
      sessionRunManager: SessionRunManager;
    },
  ): AsyncIterable<NcpEndpointEvent> {
    const { input, result, session, sessionRunManager } = params;
    if (Object.keys(result.metadataPatch).length > 0) {
      await sessionRunManager.updateSessionMetadata(session.sessionId, result.metadataPatch);
    }
    const contextWindowEvent = {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: input.sessionId,
        contextWindow: result.contextWindow,
      },
    } as const;
    await sessionRunManager.appendSessionEvent(session.sessionId, contextWindowEvent);
    yield contextWindowEvent;
    if (!result.timelineMessage) {
      return;
    }
    const activeRun = session.stateManager.getSnapshot().activeRun;
    session.stateManager.hydrate({
      sessionId: input.sessionId,
      messages: result.sessionMessages,
      activeRun,
      contextWindow: result.contextWindow,
    });
    const timelineEvent = {
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: input.sessionId,
        message: result.timelineMessage,
      },
    } as const;
    await sessionRunManager.appendSessionEvent(session.sessionId, timelineEvent);
    yield timelineEvent;
  };
}
