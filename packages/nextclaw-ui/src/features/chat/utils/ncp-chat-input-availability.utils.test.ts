import { describe, expect, it } from 'vitest';
import {
  hasNcpChatModelOptions,
  isNcpChatComposerDisabled,
  isNcpChatModelOptionsEmpty,
  isNcpChatModelOptionsLoading,
  isNcpChatSendDisabled,
} from '@/features/chat/utils/ncp-chat-input-availability.utils';
import type { ChatInputSnapshot } from '@/features/chat/stores/chat-input.store';

function createSnapshot(
  overrides: Partial<ChatInputSnapshot> = {}
): ChatInputSnapshot {
  return {
    isProviderStateResolved: false,
    composerNodes: [],
    attachments: [],
    draft: '',
    pendingSessionType: 'native',
    pendingProjectRoot: null,
    pendingProjectRootSessionKey: null,
    defaultSessionType: 'native',
    canStopGeneration: false,
    stopDisabledReason: null,
    sendError: null,
    isSending: false,
    modelOptions: [],
    selectedModel: '',
    selectedThinkingLevel: null,
    sessionTypeOptions: [],
    selectedSessionType: 'native',
    stopSupported: false,
    stopReason: undefined,
    canEditSessionType: true,
    sessionTypeUnavailable: false,
    skillRecords: [],
    isSkillsLoading: false,
    selectedSkills: [],
    ...overrides,
  };
}

describe('ncp-chat-input-availability.utils', () => {
  it('keeps the composer editable during cold start while runtime blocking still prevents send', () => {
    const snapshot = createSnapshot({
      isProviderStateResolved: false,
      modelOptions: [],
      sessionTypeUnavailable: false,
    });

    expect(hasNcpChatModelOptions(snapshot)).toBe(false);
    expect(isNcpChatModelOptionsLoading(snapshot)).toBe(true);
    expect(isNcpChatComposerDisabled(snapshot)).toBe(false);
    expect(
      isNcpChatSendDisabled({
        snapshot,
        hasSendableDraft: true,
        isRuntimeBlocked: true,
      })
    ).toBe(true);
  });

  it('does not block send only because model options have not loaded yet', () => {
    const snapshot = createSnapshot({
      isProviderStateResolved: false,
      modelOptions: [],
      sessionTypeUnavailable: false,
    });

    expect(
      isNcpChatSendDisabled({
        snapshot,
        hasSendableDraft: true,
        isRuntimeBlocked: false,
      })
    ).toBe(false);
  });

  it('marks model options as empty only after provider state resolves', () => {
    const loadingSnapshot = createSnapshot({
      isProviderStateResolved: false,
      modelOptions: [],
    });
    const emptySnapshot = createSnapshot({
      isProviderStateResolved: true,
      modelOptions: [],
    });

    expect(isNcpChatModelOptionsEmpty(loadingSnapshot)).toBe(false);
    expect(isNcpChatModelOptionsEmpty(emptySnapshot)).toBe(true);
  });

  it('keeps editing and sending available when the selected session type reports unavailable', () => {
    const snapshot = createSnapshot({
      isProviderStateResolved: true,
      sessionTypeUnavailable: true,
    });

    expect(isNcpChatComposerDisabled(snapshot)).toBe(false);
    expect(
      isNcpChatSendDisabled({
        snapshot,
        hasSendableDraft: true,
        isRuntimeBlocked: false,
      })
    ).toBe(false);
  });

  it('blocks send when there is no sendable draft', () => {
    const snapshot = createSnapshot({
      isProviderStateResolved: true,
      modelOptions: [],
      sessionTypeUnavailable: true,
    });

    expect(
      isNcpChatSendDisabled({
        snapshot,
        hasSendableDraft: false,
        isRuntimeBlocked: false,
      })
    ).toBe(true);
  });
});
