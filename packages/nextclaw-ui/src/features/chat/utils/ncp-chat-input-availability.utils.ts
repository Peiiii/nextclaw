import type { ChatInputSnapshot } from '@/components/chat/stores/chat-input.store';

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
  snapshot: NcpChatInputAvailabilitySnapshot
): boolean {
  return snapshot.sessionTypeUnavailable;
}

export function isNcpChatSendDisabled(params: {
  hasSendableDraft: boolean;
  snapshot: NcpChatInputAvailabilitySnapshot;
  isRuntimeBlocked: boolean;
}): boolean {
  const { hasSendableDraft, isRuntimeBlocked, snapshot } = params;

  return (
    isRuntimeBlocked ||
    !hasSendableDraft ||
    !hasNcpChatModelOptions(snapshot) ||
    snapshot.sessionTypeUnavailable
  );
}
