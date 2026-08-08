import { estimateInputTokens } from "@nextclaw/core";
import type { ContextWindowSnapshot } from "@nextclaw/core";
import type { NcpMessage, NcpTool } from "@nextclaw/ncp";
import { ContextCompactionPreflightService } from "@kernel/features/context-compaction/index.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import {
  buildContextBlockInputMessages,
  estimateToolInputTokens,
} from "@kernel/utils/agent-model-input-budget.utils.js";
import type { AgentManager } from "./agent.manager.js";
import type { ContextProviderManager } from "./context-provider.manager.js";
import type { ToolProviderManager } from "./tool-provider.manager.js";

const MINIMUM_DYNAMIC_INPUT_TOKENS = 256;
const MINIMUM_CONFIGURABLE_CONTEXT_TOKENS = 1_000;

export type AgentContextWindowEvaluation = {
  agentId: string;
  contextTokens: number;
  fixedInputTokens: number;
  minimumContextTokens: number;
  reservedContextTokens: number;
};

export type AgentRunSurface = {
  contextBlocks: readonly string[];
  tools: readonly NcpTool[];
};

type SessionRunInputBudget = {
  agentId: string;
  fixedInputTokens: number;
};

export class AgentContextWindowManager {
  private readonly runInputBudgetBySession = new Map<string, SessionRunInputBudget>();
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    private readonly agentManager: AgentManager,
    private readonly contextProviderManager: ContextProviderManager,
    private readonly toolProviderManager: ToolProviderManager,
  ) {
    this.preflightService = new ContextCompactionPreflightService(agentManager);
  }

  resolveRunSurface = async (request: AgentRunRequest): Promise<AgentRunSurface> => {
    const surface = await this.buildRunSurface(request);
    if (request.sessionId) {
      const profile = this.agentManager.resolveAgentProfileForRun({
        agentId: request.agentId,
        requestMetadata: request.metadata,
      });
      this.runInputBudgetBySession.set(request.sessionId, {
        agentId: profile.id,
        fixedInputTokens: this.estimateFixedInputTokens(surface),
      });
    }
    return surface;
  };

  forgetSession = (sessionId: string): void => {
    this.runInputBudgetBySession.delete(sessionId);
  };

  previewSession = async (params: {
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): Promise<ContextWindowSnapshot | null> => {
    const {
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    } = params;
    const rememberedBudget = this.runInputBudgetBySession.get(sessionId);
    const agentId = storedAgentId ?? rememberedBudget?.agentId;
    const fixedInputTokens = rememberedBudget && rememberedBudget.agentId === agentId
      ? rememberedBudget.fixedInputTokens
      : await this.resolveSessionFixedInputTokens({
          ...params,
          agentId,
        });
    return this.preflightService.preview({
      completeInputBudget: fixedInputTokens > 0,
      fixedInputTokens,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId: agentId,
      storedMetadata,
    });
  };

  assertCanSave = async (params: {
    agentId: string;
    contextTokens: number;
  }): Promise<AgentContextWindowEvaluation> => {
    const { agentId, contextTokens } = params;
    if (!Number.isInteger(contextTokens) || contextTokens < MINIMUM_CONFIGURABLE_CONTEXT_TOKENS) {
      throw new Error(
        `Agent "${agentId}" context window must be an integer of at least ${MINIMUM_CONFIGURABLE_CONTEXT_TOKENS} tokens.`,
      );
    }

    const request = this.createValidationRequest(agentId);
    const fixedInputTokens = this.estimateFixedInputTokens(
      await this.resolveRunSurface(request),
    );
    const minimumContextTokens = this.resolveMinimumContextTokens({
      agentId,
      fixedInputTokens,
    });
    const profile = this.agentManager.resolveAgentProfileForContextWindow({
      agentId,
      contextTokens,
    });
    const evaluation = {
      agentId,
      contextTokens,
      fixedInputTokens,
      minimumContextTokens,
      reservedContextTokens: profile.reservedContextTokens,
    };
    if (contextTokens < minimumContextTokens) {
      throw new Error(
        `Agent "${agentId}" needs at least ${minimumContextTokens} context tokens with its current instructions, tools, and output reserve; received ${contextTokens}.`,
      );
    }
    return evaluation;
  };

  assertDefaultCanSave = async (
    contextTokens: number,
  ): Promise<AgentContextWindowEvaluation[]> => {
    const inheritedAgents = this.agentManager
      .listAgents()
      .filter((agent) => agent.contextTokens === undefined);
    const evaluations: AgentContextWindowEvaluation[] = [];
    for (const agent of inheritedAgents) {
      evaluations.push(await this.assertCanSave({
        agentId: agent.id,
        contextTokens,
      }));
    }
    return evaluations;
  };

  private createValidationRequest = (agentId: string): AgentRunRequest => {
    const messageId = `context-window-validation-${agentId}`;
    const message: NcpMessage = {
      id: messageId,
      sessionId: "",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "" }],
      timestamp: new Date(0).toISOString(),
      metadata: { agent_id: agentId, context_window_validation: true },
    };
    return {
      agentId,
      message,
      metadata: message.metadata,
    };
  };

  private estimateFixedInputTokens = (surface: AgentRunSurface): number =>
    estimateInputTokens(buildContextBlockInputMessages(surface.contextBlocks))
    + estimateToolInputTokens(surface.tools);

  private resolveSessionFixedInputTokens = async (params: {
    agentId?: string;
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
  }): Promise<number> => {
    const {
      agentId,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
    } = params;
    const message = [...sessionMessages]
      .reverse()
      .find((candidate) => candidate.role === "user")
      ?? this.createValidationRequest(storedAgentId ?? "main").message;
    const surface = await this.buildRunSurface({
      agentId: agentId ?? storedAgentId,
      message,
      metadata: {
        ...requestMetadata,
        ...(message.metadata ?? {}),
      },
      sessionId,
    });
    return this.estimateFixedInputTokens(surface);
  };

  private buildRunSurface = async (
    request: AgentRunRequest,
  ): Promise<AgentRunSurface> => ({
    contextBlocks: await this.contextProviderManager.buildContext(request),
    tools: await this.toolProviderManager.buildTools(request),
  });

  private resolveMinimumContextTokens = (params: {
    agentId: string;
    fixedInputTokens: number;
  }): number => {
    const fits = (contextTokens: number): boolean => {
      try {
        const profile = this.agentManager.resolveAgentProfileForContextWindow({
          agentId: params.agentId,
          contextTokens,
        });
        return contextTokens - profile.reservedContextTokens
          >= params.fixedInputTokens + MINIMUM_DYNAMIC_INPUT_TOKENS;
      } catch {
        return false;
      }
    };
    let upper = Math.max(
      MINIMUM_CONFIGURABLE_CONTEXT_TOKENS,
      params.fixedInputTokens + MINIMUM_DYNAMIC_INPUT_TOKENS,
    );
    while (!fits(upper)) {
      upper *= 2;
    }
    let lower = MINIMUM_CONFIGURABLE_CONTEXT_TOKENS;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (fits(middle)) {
        upper = middle;
      } else {
        lower = middle + 1;
      }
    }
    return lower;
  };
}
