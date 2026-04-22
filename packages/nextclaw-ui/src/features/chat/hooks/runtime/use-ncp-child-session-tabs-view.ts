import { useMemo } from "react";
import type { SessionEntryView } from "@/shared/lib/api";
import { sessionDisplayName } from "@/features/chat/utils/chat-session-display.utils";
import { adaptNcpSessionSummaries } from "@/features/chat/utils/ncp-session-adapter.utils";
import { resolveSessionTypeLabel } from "@/features/chat/hooks/use-chat-session-type-state";
import type { ChatChildSessionTab } from "@/features/chat/stores/chat-thread.store";
import { useNcpSessions } from "@/shared/hooks/use-config";
import type { SessionRunStatus } from "@/features/chat/types/session-run-status.types";

export type ResolvedChildSessionTab = {
  sessionKey: string;
  parentSessionKey: string | null;
  title: string;
  agentId: string | null;
  updatedAt: string | null;
  lastMessageAt: string | null;
  readAt: string | null;
  runStatus?: SessionRunStatus;
  sessionTypeLabel: string | null;
  preferredModel: string | null;
  projectName: string | null;
  projectRoot: string | null;
};

function resolveChildSessionTitle(
  tab: ChatChildSessionTab,
  session: SessionEntryView | null,
): string {
  if (tab.label?.trim()) {
    return tab.label.trim();
  }
  if (session) {
    return sessionDisplayName(session);
  }
  return tab.sessionKey;
}

export function useNcpChildSessionTabsView(
  tabs: readonly ChatChildSessionTab[],
): ResolvedChildSessionTab[] {
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const summaries = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data?.sessions],
  );

  const sessionByKey = useMemo(() => {
    const sessions = adaptNcpSessionSummaries(summaries);
    return new Map(sessions.map((session) => [session.key, session]));
  }, [summaries]);

  const summaryByKey = useMemo(
    () => new Map(summaries.map((summary) => [summary.sessionId, summary])),
    [summaries],
  );

  return useMemo(
    () =>
      tabs.map((tab) => {
        const session = sessionByKey.get(tab.sessionKey) ?? null;
        const summary = summaryByKey.get(tab.sessionKey) ?? null;
        const agentId = tab.agentId?.trim() || session?.agentId || null;
        return {
          sessionKey: tab.sessionKey,
          parentSessionKey: tab.parentSessionKey,
          title: resolveChildSessionTitle(tab, session),
          agentId,
          updatedAt: session?.updatedAt ?? null,
          lastMessageAt: session?.lastMessageAt ?? null,
          readAt: session?.readAt ?? null,
          runStatus: summary?.status === "running" ? "running" : undefined,
          sessionTypeLabel: session?.sessionType
            ? resolveSessionTypeLabel(session.sessionType)
            : null,
          preferredModel: session?.preferredModel?.trim() || null,
          projectName: session?.projectName?.trim() || null,
          projectRoot: session?.projectRoot?.trim() || null,
        };
      }),
    [sessionByKey, summaryByKey, tabs],
  );
}
