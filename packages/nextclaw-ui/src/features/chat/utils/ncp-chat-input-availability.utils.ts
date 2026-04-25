import type { ChatInputSnapshot } from '@/features/chat/stores/chat-input.store';

type NcpChatInputAvailabilitySnapshot = Pick<
  ChatInputSnapshot,
  'isProviderStateResolved' | 'modelOptions' | 'sessionTypeUnavailable'
>;

export function hasNcpChatModelOptions(
  snapshot: NcpChatInputAvailabilitySnapshot
): boolean {
  return snapshot.modelOptions.length > 0;
}

export function isNcpChatModelOptionsLoading(
  snapshot: NcpChatInputAvailabilitySnapshot
): boolean {
  return !snapshot.isProviderStateResolved && !hasNcpChatModelOptions(snapshot);
}

export function isNcpChatModelOptionsEmpty(
  snapshot: NcpChatInputAvailabilitySnapshot
): boolean {
  return snapshot.isProviderStateResolved && !hasNcpChatModelOptions(snapshot);
}

export function isNcpChatComposerDisabled(
  _snapshot: NcpChatInputAvailabilitySnapshot
): boolean {
  return false;
}

export function isNcpChatSendDisabled(params: {
  hasSendableDraft: boolean;
  snapshot: NcpChatInputAvailabilitySnapshot;
  isRuntimeBlocked: boolean;
}): boolean {
  const { hasSendableDraft, isRuntimeBlocked } = params;

  return (
    isRuntimeBlocked ||
    !hasSendableDraft
  );
}
