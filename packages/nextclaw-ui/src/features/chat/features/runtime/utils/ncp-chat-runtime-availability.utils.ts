import { isTransientRuntimeConnectionErrorMessage, type SystemStatusView } from '@/features/system-status';
import { t } from '@/shared/lib/i18n';

type ChatRuntimeStatus = Pick<SystemStatusView, 'activeSystemAction' | 'bootstrapStatus' | 'lastError' | 'lastReadyAt' | 'lifecyclePhase' | 'phase'>;

export function isNcpChatRuntimeBlocked(status: Pick<SystemStatusView, 'bootstrapStatus'>): boolean {
  return status.bootstrapStatus?.ncpAgent.state !== 'ready';
}

export function resolveNcpChatRuntimeMessage(
  status: ChatRuntimeStatus
): string | null {
  const actionMessage = status.activeSystemAction?.message?.trim();
  if (actionMessage) return actionMessage;
  if (status.lifecyclePhase === 'cold-starting') {
    return t('chatRuntimeInitializing');
  }
  if (status.lifecyclePhase === 'startup-failed') {
    return (
      status.bootstrapStatus?.ncpAgent.error?.trim() ||
      status.bootstrapStatus?.lastError?.trim() ||
      status.lastError?.trim() ||
      t('chatRuntimeInitializationFailed')
    );
  }
  return null;
}

export function resolveNcpChatSendErrorMessage(params: {
  message: string | null | undefined;
  status: ChatRuntimeStatus;
}): string | null {
  const { message: rawMessage, status } = params;
  const message = rawMessage?.trim();
  if (!message) {
    return resolveNcpChatRuntimeMessage(status);
  }
  const actionMessage = status.activeSystemAction?.message?.trim();
  if (status.phase === 'service-transitioning' && actionMessage) {
    return actionMessage;
  }
  const isTransientTransportError = isTransientRuntimeConnectionErrorMessage(message);
  if (status.phase === 'recovering' && isTransientTransportError) {
    return t('runtimeControlRecoveringHelp');
  }
  if (status.phase === 'stalled' && isTransientTransportError) {
    return null;
  }
  return message;
}
