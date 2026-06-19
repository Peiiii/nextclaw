import type { NcpSessionSummaryView } from "@/shared/lib/api";
import { adaptNcpSessionSummaries } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { getSessionProjectName } from "@/shared/lib/session-project";

export type ChatWelcomeProjectOption = {
  projectRoot: string;
  projectName: string;
  sessionCount: number;
};

function readSessionActivityAt(session: {
  createdAt: string;
  lastMessageAt?: string;
}): number {
  return new Date(session.lastMessageAt ?? session.createdAt).getTime();
}

export function buildChatWelcomeProjectOptions(params: {
  defaultProjectRoot: string | null;
  sessionSummaries: readonly NcpSessionSummaryView[];
}): ChatWelcomeProjectOption[] {
  const { defaultProjectRoot, sessionSummaries } = params;
  const groups = new Map<
    string,
    ChatWelcomeProjectOption & { latestUpdatedAt: number }
  >();

  for (const session of adaptNcpSessionSummaries([...sessionSummaries])) {
    const projectRoot = session.projectRoot?.trim();
    if (!projectRoot || projectRoot === defaultProjectRoot) {
      continue;
    }
    const existing = groups.get(projectRoot);
    const latestUpdatedAt = readSessionActivityAt(session);
    if (existing) {
      existing.sessionCount += 1;
      existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, latestUpdatedAt);
      continue;
    }
    groups.set(projectRoot, {
      projectRoot,
      projectName:
        session.projectName?.trim() ||
        getSessionProjectName(projectRoot) ||
        projectRoot,
      sessionCount: 1,
      latestUpdatedAt,
    });
  }

  return [...groups.values()]
    .sort((left, right) => {
      return right.latestUpdatedAt - left.latestUpdatedAt;
    })
    .map(({ latestUpdatedAt: _latestUpdatedAt, ...option }) => option);
}
