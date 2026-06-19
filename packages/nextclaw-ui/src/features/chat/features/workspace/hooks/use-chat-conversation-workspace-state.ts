import { useMemo } from "react";
import { useCronJobs } from "@/features/cron";
import type { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { adaptNcpSessionSummaries } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { isCronJobForSession } from "@/shared/lib/cron";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";

type ChatThreadSnapshot = ReturnType<
  typeof useChatThreadStore.getState
>["snapshot"];

const EMPTY_SESSION_SUMMARIES: never[] = [];

export function useChatConversationWorkspaceState(
  snapshot: ChatThreadSnapshot,
  sessionKey: string | null,
) {
  const sessionSummaries = useChatQueryStore(
    (state) =>
      state.snapshot.sessionsQuery?.data?.sessions ?? EMPTY_SESSION_SUMMARIES,
  );
  const childSessionTabs = useMemo(() => {
    const tabs = snapshot.childSessionTabs.filter(
      (tab) => tab.parentSessionKey === sessionKey,
    );
    const tabKeys = new Set(tabs.map((tab) => tab.sessionKey));
    return [
      ...tabs,
      ...adaptNcpSessionSummaries(sessionSummaries)
        .filter(
          (session) =>
            session.parentSessionId === sessionKey && !tabKeys.has(session.key),
        )
        .map((session) => ({
          sessionKey: session.key,
          parentSessionKey: sessionKey,
        })),
    ];
  }, [sessionKey, sessionSummaries, snapshot.childSessionTabs]);
  const workspaceFileTabs = useMemo(
    () =>
      snapshot.workspaceFileTabs.filter(
        (tab) => tab.parentSessionKey === sessionKey,
      ),
    [sessionKey, snapshot.workspaceFileTabs],
  );
  const activeSideChatDraft =
    snapshot.activeSideChatDraft?.parentSessionKey === sessionKey
      ? snapshot.activeSideChatDraft
      : null;
  const cronQuery = useCronJobs({ all: true });
  const sessionCronJobs = useMemo(
    () =>
      (cronQuery.data?.jobs ?? []).filter((job) =>
        isCronJobForSession(job, sessionKey),
      ),
    [cronQuery.data?.jobs, sessionKey],
  );

  return {
    childSessionTabs,
    activeSideChatDraft,
    workspaceFileTabs,
    sessionCronJobs,
    showWorkspacePanel:
      snapshot.workspacePanelParentKey === sessionKey &&
      (activeSideChatDraft !== null ||
        childSessionTabs.length > 0 ||
        workspaceFileTabs.length > 0 ||
        sessionCronJobs.length > 0),
  };
}
