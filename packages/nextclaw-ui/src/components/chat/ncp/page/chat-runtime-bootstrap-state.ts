import type { BootstrapStatusView } from '@/api/types';

export type ChatRuntimeBootstrapStage = 'initializing' | 'ready' | 'error';

export function resolveChatRuntimeBootstrapStage(
  bootstrapStatus: BootstrapStatusView | null | undefined
): ChatRuntimeBootstrapStage {
  const state = bootstrapStatus?.ncpAgent.state;
  if (state === 'ready') {
    return 'ready';
  }
  if (state === 'error') {
    return 'error';
  }
  return 'initializing';
}
