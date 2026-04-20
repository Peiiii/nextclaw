import { describe, expect, it } from 'vitest';
import {
  hasNcpChatModelOptions,
  isNcpChatComposerDisabled,
  isNcpChatModelOptionsEmpty,
  isNcpChatModelOptionsLoading,
  isNcpChatSendDisabled,
} from '@/features/chat/utils/ncp-chat-input-availability.utils';
import type { ChatInputSnapshot } from '@/components/chat/stores/chat-input.store';

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
  it('keeps the composer editable during cold start while send remains blocked', () => {
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

  it('disables both editing and sending when the session type is unavailable', () => {
    const snapshot = createSnapshot({
      isProviderStateResolved: true,
      sessionTypeUnavailable: true,
    });

    expect(isNcpChatComposerDisabled(snapshot)).toBe(true);
    expect(
      isNcpChatSendDisabled({
        snapshot,
        hasSendableDraft: true,
        isRuntimeBlocked: false,
      })
    ).toBe(true);
  });
});
