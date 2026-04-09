import { useMemo } from "react";
import type { SessionEntryView } from "@/api/types";
import { sessionDisplayName } from "@/components/chat/chat-session-display";
import { adaptNcpSessionSummaries } from "@/components/chat/ncp/ncp-session-adapter";
import { resolveSessionTypeLabel } from "@/components/chat/useChatSessionTypeState";
import type { ChatChildSessionTab } from "@/components/chat/stores/chat-thread.store";
import { useNcpSessions } from "@/hooks/useConfig";

export type ResolvedChildSessionTab = {
  sessionKey: string;
  parentSessionKey: string | null;
  title: string;
  agentId: string | null;
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

  const sessionByKey = useMemo(() => {
    const sessions = adaptNcpSessionSummaries(
      sessionsQuery.data?.sessions ?? [],
    );
    return new Map(sessions.map((session) => [session.key, session]));
  }, [sessionsQuery.data?.sessions]);

  return useMemo(
    () =>
      tabs.map((tab) => {
        const session = sessionByKey.get(tab.sessionKey) ?? null;
        const agentId = tab.agentId?.trim() || session?.agentId || null;
        return {
          sessionKey: tab.sessionKey,
          parentSessionKey: tab.parentSessionKey,
          title: resolveChildSessionTitle(tab, session),
          agentId,
          sessionTypeLabel: session?.sessionType
            ? resolveSessionTypeLabel(session.sessionType)
            : null,
          preferredModel: session?.preferredModel?.trim() || null,
          projectName: session?.projectName?.trim() || null,
          projectRoot: session?.projectRoot?.trim() || null,
        };
      }),
    [sessionByKey, tabs],
  );
}
