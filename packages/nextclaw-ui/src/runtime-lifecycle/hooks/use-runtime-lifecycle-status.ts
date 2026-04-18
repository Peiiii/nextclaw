import { t } from '@/lib/i18n';
import { useRuntimeLifecycleStore } from '../runtime-lifecycle.store';
import type {
  RuntimeConnectionStatus,
  RuntimeLifecyclePhase,
  RuntimeLifecycleSnapshot,
  RuntimeLifecycleView,
} from '../runtime-lifecycle.types';

export function resolveRuntimeConnectionStatus(
  phase: RuntimeLifecyclePhase
): RuntimeConnectionStatus {
  if (phase === 'ready') {
    return 'connected';
  }
  if (phase === 'startup-failed' || phase === 'stalled') {
    return 'disconnected';
  }
  return 'connecting';
}

export function resolveChatRuntimeMessage(
  snapshot: RuntimeLifecycleSnapshot
): string | null {
  if (snapshot.phase === 'cold-starting') {
    return t('chatRuntimeInitializing');
  }
  if (snapshot.phase === 'startup-failed') {
    return (
      snapshot.bootstrapStatus?.ncpAgent.error?.trim() ||
      snapshot.bootstrapStatus?.lastError?.trim() ||
      snapshot.lastError?.trim() ||
      t('chatRuntimeInitializationFailed')
    );
  }
  if (snapshot.phase === 'recovering') {
    return t('runtimeControlRecoveringHelp');
  }
  if (snapshot.phase === 'stalled') {
    return t('runtimeRecoveryTimedOut');
  }
  return null;
}

export function toRuntimeLifecycleView(
  snapshot: RuntimeLifecycleSnapshot
): RuntimeLifecycleView {
  return {
    ...snapshot,
    chatRuntimeBlocked: snapshot.phase !== 'ready',
    chatRuntimeMessage: resolveChatRuntimeMessage(snapshot),
    connectionStatus: resolveRuntimeConnectionStatus(snapshot.phase),
  };
}

export function useRuntimeLifecycleStatus(): RuntimeLifecycleView {
  const snapshot = useRuntimeLifecycleStore((state) => state.snapshot);
  return toRuntimeLifecycleView(snapshot);
}
