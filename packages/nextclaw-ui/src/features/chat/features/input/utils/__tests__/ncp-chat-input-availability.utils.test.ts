import { describe, expect, it } from 'vitest';
import {
  hasNcpChatModelOptions,
  isNcpChatComposerDisabled,
  isNcpChatModelOptionsEmpty,
  isNcpChatModelOptionsLoading,
  isNcpChatSendDisabled,
} from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';

type AvailabilitySnapshot = {
  readonly isProviderStateResolved: boolean;
  readonly modelOptions: readonly unknown[];
  readonly sessionTypeUnavailable: boolean;
};

function createSnapshot(overrides: Partial<AvailabilitySnapshot> = {}): AvailabilitySnapshot {
  return {
    isProviderStateResolved: false,
    modelOptions: [],
    sessionTypeUnavailable: false,
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
