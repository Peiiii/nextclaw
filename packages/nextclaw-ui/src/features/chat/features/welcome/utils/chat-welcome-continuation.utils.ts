import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import type { NcpSessionSummaryView } from '@/shared/lib/api';

export type ChatWelcomeContinuation = { sessionKey: string; title: string };

export function resolveChatWelcomeContinuation(params: {
  sessions: readonly NcpSessionSummaryView[];
  projectRoot: string | null;
  defaultProjectRoot: string | null;
  agentId: string;
}): ChatWelcomeContinuation | null {
  const candidates = adaptNcpSessionSummaries([...params.sessions]).filter((session) =>
    !session.isChildSession && session.messageCount > 0 && session.label?.trim() &&
    (session.agentId ?? 'main') === params.agentId &&
    (session.projectRoot ?? session.workingDir ?? params.defaultProjectRoot) === params.projectRoot,
  );
  const activityAt = (session: typeof candidates[number]) =>
    Date.parse(session.lastMessageAt ?? session.updatedAt) || 0;
  const recent = candidates.sort((a, b) => activityAt(b) - activityAt(a))[0];
  return recent ? { sessionKey: recent.key, title: recent.label!.trim() } : null;
}
