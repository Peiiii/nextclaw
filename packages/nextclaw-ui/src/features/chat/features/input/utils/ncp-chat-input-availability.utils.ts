type ChatInputAvailabilitySnapshot = {
  readonly isProviderStateResolved: boolean;
  readonly modelOptions: readonly unknown[];
  readonly sessionTypeUnavailable?: boolean;
};

export function hasNcpChatModelOptions(
  snapshot: ChatInputAvailabilitySnapshot
): boolean {
  return snapshot.modelOptions.length > 0;
}

export function isNcpChatModelOptionsLoading(
  snapshot: ChatInputAvailabilitySnapshot
): boolean {
  return !snapshot.isProviderStateResolved && !hasNcpChatModelOptions(snapshot);
}

export function isNcpChatModelOptionsEmpty(
  snapshot: ChatInputAvailabilitySnapshot
): boolean {
  return snapshot.isProviderStateResolved && !hasNcpChatModelOptions(snapshot);
}

export function isNcpChatComposerDisabled(
  _snapshot: ChatInputAvailabilitySnapshot
): boolean {
  return false;
}

export function isNcpChatSendDisabled(params: {
  hasSendableDraft: boolean;
  snapshot: ChatInputAvailabilitySnapshot;
  isRuntimeBlocked: boolean;
}): boolean {
  const { hasSendableDraft, isRuntimeBlocked } = params;

  return (
    isRuntimeBlocked ||
    !hasSendableDraft
  );
}
