import { describe, expect, it } from 'vitest';
import {
  EventBus,
  Ingress,
  ingressKeys,
  type AgentRunContinueIngressPayload,
  type AgentRunEditMessageIngressPayload,
} from '@nextclaw/shared';
import {
  isHiddenNcpMessage,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpRunHandle,
} from '@nextclaw/ncp';
import { AgentRunRequestManager } from '@kernel/managers/agent-run-request.manager.js';
import { SessionRun } from '@kernel/managers/session-run.manager.js';

function createMessage(params: {
  id: string;
  role: NcpMessage['role'];
  sessionId?: string;
  text: string;
}): NcpMessage {
  const { id, role, sessionId = 'source-session', text } = params;
  return {
    id,
    sessionId,
    role,
    status: 'final',
    timestamp: '2026-08-07T10:00:00.000Z',
    parts: [{ type: 'text', text }],
  };
}

function createSessionCommandFixture(params: {
  beforeRewind?: () => Promise<void>;
  messages: NcpMessage[];
  metadata?: Record<string, unknown>;
  sourceSessionId?: string;
}) {
  const sourceSessionId = params.sourceSessionId ?? 'source-session';
  const ingress = new Ingress();
  const sessionRun = new SessionRun({
    sessionId: sourceSessionId,
    messages: structuredClone(params.messages),
  });
  const materializationCalls: Array<Record<string, unknown>> = [];
  const rewindCalls: Array<{ messageId: string; sessionId: string }> = [];
  const manager = new AgentRunRequestManager(
    {
      getOrCreate: () => ({
        run: async function* (): AsyncGenerator<NcpEndpointEvent> {},
      }),
    } as never,
    { getDefaultAgentId: () => 'main' } as never,
    {
      getDefaultModel: () => 'test-model',
      getModelMaxTokens: () => 12000,
      loadConfig: () => ({}),
    } as never,
    { buildContext: async () => [] } as never,
    new EventBus(),
    ingress,
    {
      getSessionRecord: async (sessionId: string) => sessionId === sourceSessionId
        ? {
            sessionId: sourceSessionId,
            createdAt: '2026-08-08T10:00:00.000Z',
            updatedAt: '2026-08-08T10:00:00.000Z',
            messages: structuredClone(params.messages),
            metadata: structuredClone(params.metadata ?? {}),
          }
        : null,
      rewindSessionBeforeMessage: async (sessionId: string, messageId: string) => {
        rewindCalls.push({ messageId, sessionId });
        await params.beforeRewind?.();
        const anchorIndex = params.messages.findIndex((message) => message.id === messageId);
        return {
          sessionId,
          createdAt: '2026-08-08T10:00:00.000Z',
          updatedAt: '2026-08-08T10:00:00.000Z',
          messages: structuredClone(params.messages.slice(0, anchorIndex)),
          metadata: structuredClone(params.metadata ?? {}),
        };
      },
      getOrCreateAgentRunSession: async (input: Record<string, unknown>) => {
        materializationCalls.push(structuredClone(input));
        return {
          sessionId: sourceSessionId,
          agentId: 'main',
          agentRuntimeId: 'native',
          metadata: structuredClone(params.metadata ?? {}),
          model: 'test-model',
          thinkingEffort: null,
        };
      },
    } as never,
    {
      getOrCreateSessionRun: async () => sessionRun,
      isSessionRunning: () => false,
    } as never,
    { buildTools: async () => [] } as never,
  );
  manager.start();
  return {
    ingress,
    manager,
    materializationCalls,
    rewindCalls,
    sessionRun,
    sourceSessionId,
  };
}

function createDeferred() {
  let resolve = () => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('AgentRunRequestManager edit and continuation commands', () => {
  it('rewrites the current session from the latest user message and starts the replacement run', async () => {
    const messages = [
      createMessage({ id: 'user-1', role: 'user', text: 'first' }),
      createMessage({ id: 'assistant-1', role: 'assistant', text: 'answer' }),
      createMessage({ id: 'user-2', role: 'user', text: 'original request' }),
      createMessage({ id: 'assistant-2', role: 'assistant', text: 'old branch' }),
    ];
    const fixture = createSessionCommandFixture({ messages });
    const editedMessage = createMessage({
      id: 'edited-user-2',
      role: 'user',
      sessionId: fixture.sourceSessionId,
      text: 'edited request',
    });

    const handle = await fixture.ingress.handle<
      AgentRunEditMessageIngressPayload,
      NcpRunHandle
    >({
      type: ingressKeys.agentRun.editMessage,
      payload: {
        message: editedMessage,
        messageId: 'user-2',
        sessionId: fixture.sourceSessionId,
      },
    }, { source: 'test' });

    expect(handle.sessionId).toBe(fixture.sourceSessionId);
    expect(fixture.rewindCalls).toEqual([{
      messageId: 'user-2',
      sessionId: fixture.sourceSessionId,
    }]);
    expect(fixture.sessionRun.getSnapshot().messages).toEqual([
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ id: 'assistant-1' }),
      expect.objectContaining({
        id: 'edited-user-2',
        parts: [{ type: 'text', text: 'edited request' }],
        sessionId: fixture.sourceSessionId,
      }),
    ]);
    expect(fixture.sessionRun.getSnapshot().messages.map((message) => message.id))
      .not.toContain('assistant-2');
    fixture.manager.dispose();
  });

  it('rejects editing any user message other than the latest visible one', async () => {
    const fixture = createSessionCommandFixture({
      messages: [
        createMessage({ id: 'user-1', role: 'user', text: 'first' }),
        createMessage({ id: 'user-2', role: 'user', text: 'latest' }),
      ],
    });

    await expect(fixture.ingress.handle<AgentRunEditMessageIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.editMessage,
      payload: {
        message: createMessage({ id: 'edited-user-1', role: 'user', text: 'edited' }),
        messageId: 'user-1',
        sessionId: fixture.sourceSessionId,
      },
    }, { source: 'test' })).rejects.toThrow(
      'Only the latest visible user message can be edited.',
    );
    expect(fixture.materializationCalls).toHaveLength(0);
    fixture.manager.dispose();
  });

  it('continues in the same session while preserving partial assistant progress', async () => {
    const partialAssistant = {
      ...createMessage({ id: 'assistant-partial', role: 'assistant', text: 'half done' }),
      status: 'error' as const,
    };
    const fixture = createSessionCommandFixture({
      messages: [
        createMessage({ id: 'user-1', role: 'user', text: 'do the work' }),
        partialAssistant,
      ],
      metadata: {
        last_activity_preview: { state: 'cancelled' },
      },
    });

    const handle = await fixture.ingress.handle<
      AgentRunContinueIngressPayload,
      NcpRunHandle
    >({
      type: ingressKeys.agentRun.continue,
      payload: { sessionId: fixture.sourceSessionId },
    }, { source: 'test' });
    const messages = fixture.sessionRun.getSnapshot().messages;

    expect(handle.sessionId).toBe(fixture.sourceSessionId);
    expect(messages.slice(0, 2)).toEqual([
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({
        id: 'assistant-partial',
        parts: [{ type: 'text', text: 'half done' }],
      }),
    ]);
    expect(messages.at(-1)).toSatisfy((message: NcpMessage | undefined) =>
      Boolean(message && isHiddenNcpMessage(message) && message.role === 'user')
    );
    fixture.manager.dispose();
  });

  it('deduplicates repeated edits and rejects a different session command while history is changing', async () => {
    const rewind = createDeferred();
    const fixture = createSessionCommandFixture({
      beforeRewind: () => rewind.promise,
      messages: [createMessage({ id: 'user-1', role: 'user', text: 'original' })],
      metadata: { last_activity_preview: { state: 'cancelled' } },
    });
    const editPayload = {
      message: createMessage({ id: 'edited-user-1', role: 'user', text: 'edited' }),
      messageId: 'user-1',
      sessionId: fixture.sourceSessionId,
    };
    const firstEdit = fixture.ingress.handle<AgentRunEditMessageIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.editMessage,
      payload: editPayload,
    }, { source: 'test' });
    const duplicateEdit = fixture.ingress.handle<AgentRunEditMessageIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.editMessage,
      payload: editPayload,
    }, { source: 'test' });

    await expect(fixture.ingress.handle<AgentRunContinueIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.continue,
      payload: { sessionId: fixture.sourceSessionId },
    }, { source: 'test' })).rejects.toThrow(
      'Another command is already changing this session.',
    );
    rewind.resolve();
    const [firstHandle, duplicateHandle] = await Promise.all([firstEdit, duplicateEdit]);

    expect(duplicateHandle).toEqual(firstHandle);
    expect(fixture.rewindCalls).toHaveLength(1);
    fixture.manager.dispose();
  });
});
