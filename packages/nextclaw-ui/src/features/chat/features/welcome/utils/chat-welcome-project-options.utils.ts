import type { NcpSessionSummaryView } from "@/shared/lib/api";
import { adaptNcpSessionSummaries } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { getSessionProjectName } from "@/shared/lib/session-project";

export type ChatWelcomeProjectOption = {
  projectRoot: string;
  projectName: string;
  sessionCount: number;
  isDefault: boolean;
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
    if (!projectRoot) {
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
      isDefault: projectRoot === defaultProjectRoot,
      latestUpdatedAt,
    });
  }

  if (defaultProjectRoot && !groups.has(defaultProjectRoot)) {
    groups.set(defaultProjectRoot, {
      projectRoot: defaultProjectRoot,
      projectName: getSessionProjectName(defaultProjectRoot) ?? defaultProjectRoot,
      sessionCount: 0,
      isDefault: true,
      latestUpdatedAt: Number.POSITIVE_INFINITY,
    });
  }

  return [...groups.values()]
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return right.latestUpdatedAt - left.latestUpdatedAt;
    })
    .map(({ latestUpdatedAt: _latestUpdatedAt, ...option }) => option);
}
