import { useChatRunStatusStore } from '@/components/chat/stores/chat-run-status.store';
import type { ChatRunStatusSnapshot } from '@/components/chat/stores/chat-run-status.store';

function isMapEqual<T>(left: ReadonlyMap<string, T>, right: ReadonlyMap<string, T>): boolean {
  if (left === right) {
    return true;
  }
  if (left.size !== right.size) {
    return false;
  }
  for (const [key, value] of left.entries()) {
    if (!Object.is(value, right.get(key))) {
      return false;
    }
  }
  return true;
}

export class ChatRunStatusManager {
  syncSnapshot = (patch: Partial<ChatRunStatusSnapshot>) => {
    const current = useChatRunStatusStore.getState().snapshot;
    const nextMap = patch.sessionRunStatusByKey;
    if (
      (nextMap ? isMapEqual(current.sessionRunStatusByKey, nextMap) : true) &&
      (patch.isLocallyRunning === undefined || Object.is(current.isLocallyRunning, patch.isLocallyRunning)) &&
      (patch.activeBackendRunId === undefined || Object.is(current.activeBackendRunId, patch.activeBackendRunId))
    ) {
      return;
    }
    useChatRunStatusStore.getState().setSnapshot(patch);
  };
}
