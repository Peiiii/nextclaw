import { describe, expect, it } from 'vitest';
import type { NcpAiExecutionMetadata, NcpMessage } from '@nextclaw/ncp';
import { buildSessionTokenUsageSummary } from '@kernel/managers/session-token-usage.manager.js';

function createAssistantMessage(params: {
  id: string;
  execution: NcpAiExecutionMetadata;
  inherited?: boolean;
}): NcpMessage {
  return {
    id: params.id,
    sessionId: 'session-usage',
    role: 'assistant',
    status: 'final',
    parts: [{ type: 'text', text: 'done' }],
    timestamp: '2026-08-14T00:00:00.000Z',
    metadata: {
      ai_execution: params.execution,
      ...(params.inherited ? { inherited_from_session_id: 'parent-session' } : {}),
    },
  };
}

describe('buildSessionTokenUsageSummary', () => {
  it('groups direct session usage by effective model and deduplicates projected runs', () => {
    const gptExecution: NcpAiExecutionMetadata = {
      version: 1,
      runId: 'run-gpt-1',
      runtimeId: 'native',
      model: 'openai/gpt-5',
      requestedModel: 'openai/gpt-5',
      outcome: 'completed',
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 30,
        totalTokens: 120,
        modelCallCount: 2,
        reportedModelCallCount: 2,
        status: 'reported',
      },
    };
    const claudeExecution: NcpAiExecutionMetadata = {
      version: 1,
      runId: 'run-claude-1',
      runtimeId: 'native',
      model: 'anthropic/claude-sonnet-4',
      requestedModel: null,
      outcome: 'failed',
      usage: {
        inputTokens: 50,
        outputTokens: null,
        cachedInputTokens: 10,
        totalTokens: null,
        modelCallCount: 2,
        reportedModelCallCount: 1,
        status: 'partial',
      },
    };

    const summary = buildSessionTokenUsageSummary({
      sessionId: 'session-usage',
      messages: [
        createAssistantMessage({ id: 'assistant-gpt', execution: gptExecution }),
        createAssistantMessage({ id: 'assistant-gpt-duplicate', execution: gptExecution }),
        createAssistantMessage({ id: 'assistant-claude', execution: claudeExecution }),
        createAssistantMessage({
          id: 'assistant-inherited',
          inherited: true,
          execution: {
            ...gptExecution,
            runId: 'run-parent',
            usage: {
              ...gptExecution.usage,
              inputTokens: 999,
              totalTokens: 1_019,
            },
          },
        }),
      ],
    });

    expect(summary).toEqual({
      sessionId: 'session-usage',
      totals: {
        inputTokens: 150,
        outputTokens: 20,
        cachedInputTokens: 40,
        totalTokens: 120,
        cacheHitRate: 40 / 150,
      },
      models: [
        {
          model: 'openai/gpt-5',
          inputTokens: 100,
          outputTokens: 20,
          cachedInputTokens: 30,
          totalTokens: 120,
          cacheHitRate: 0.3,
          runCount: 1,
          modelCallCount: 2,
          reportedModelCallCount: 2,
          status: 'reported',
        },
        {
          model: 'anthropic/claude-sonnet-4',
          inputTokens: 50,
          outputTokens: null,
          cachedInputTokens: 10,
          totalTokens: null,
          cacheHitRate: 0.2,
          runCount: 1,
          modelCallCount: 2,
          reportedModelCallCount: 1,
          status: 'partial',
        },
      ],
      runCount: 2,
      modelCallCount: 4,
      reportedModelCallCount: 3,
      status: 'partial',
    });
  });

  it('keeps cache hit rate unavailable when a run omits cache usage', () => {
    const summary = buildSessionTokenUsageSummary({
      sessionId: 'session-partial-cache',
      messages: [
        createAssistantMessage({
          id: 'assistant-partial-cache',
          execution: {
            version: 1,
            runId: 'run-partial-cache',
            runtimeId: 'external',
            model: 'custom/model',
            requestedModel: null,
            outcome: 'completed',
            usage: {
              inputTokens: 100,
              outputTokens: 10,
              cachedInputTokens: null,
              totalTokens: 110,
              modelCallCount: 1,
              reportedModelCallCount: 1,
              status: 'reported',
            },
          },
        }),
      ],
    });

    expect(summary).toMatchObject({
      totals: { cachedInputTokens: null, cacheHitRate: null },
      models: [{ cachedInputTokens: null, cacheHitRate: null }],
    });
  });
});
