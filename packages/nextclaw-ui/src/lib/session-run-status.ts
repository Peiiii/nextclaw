import type { ChatRunState, ChatRunView } from '@/api/types';

export type SessionRunStatus = Extract<ChatRunState, 'queued' | 'running'>;

const RUN_STATUS_PRIORITY: Record<SessionRunStatus, number> = {
  queued: 1,
  running: 2
};

function toSessionRunStatus(state: ChatRunState): SessionRunStatus | null {
  if (state === 'queued' || state === 'running') {
    return state;
  }
  return null;
}

function toComparableTimestamp(value?: string): number {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldReplaceRun(current: ChatRunView, next: ChatRunView): boolean {
  const currentStatus = toSessionRunStatus(current.state);
  const nextStatus = toSessionRunStatus(next.state);
  if (!currentStatus || !nextStatus) {
    return false;
  }
  const currentPriority = RUN_STATUS_PRIORITY[currentStatus];
  const nextPriority = RUN_STATUS_PRIORITY[nextStatus];
  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority;
  }
  return toComparableTimestamp(next.requestedAt) >= toComparableTimestamp(current.requestedAt);
}

export function buildActiveRunBySessionKey(runs: readonly ChatRunView[]): Map<string, ChatRunView> {
  const map = new Map<string, ChatRunView>();
  for (const run of runs) {
    const key = run.sessionKey?.trim();
    if (!key || !toSessionRunStatus(run.state)) {
      continue;
    }
    const current = map.get(key);
    if (!current || shouldReplaceRun(current, run)) {
      map.set(key, run);
    }
  }
  return map;
}

export function buildSessionRunStatusByKey(
  activeRunBySessionKey: ReadonlyMap<string, ChatRunView>
): Map<string, SessionRunStatus> {
  const map = new Map<string, SessionRunStatus>();
  for (const [sessionKey, run] of activeRunBySessionKey.entries()) {
    const status = toSessionRunStatus(run.state);
    if (!status) {
      continue;
    }
    map.set(sessionKey, status);
  }
  return map;
}
