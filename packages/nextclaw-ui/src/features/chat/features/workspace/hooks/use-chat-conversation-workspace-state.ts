import { useMemo } from "react";
import { useCronJobs } from "@/features/cron";
import type { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { isCronJobForSession } from "@/shared/lib/cron";

type ChatThreadSnapshot = ReturnType<
  typeof useChatThreadStore.getState
>["snapshot"];

function shouldShowWorkspacePanel(
  snapshot: ChatThreadSnapshot,
  childSessionTabs: ChatThreadSnapshot["childSessionTabs"],
  workspaceFileTabs: ChatThreadSnapshot["workspaceFileTabs"],
  sessionCronJobCount: number,
) {
  if (snapshot.workspacePanelParentKey !== snapshot.sessionKey) {
    return false;
  }
  return (
    childSessionTabs.length > 0 ||
    workspaceFileTabs.length > 0 ||
    sessionCronJobCount > 0
  );
}

export function useChatConversationWorkspaceState(
  snapshot: ChatThreadSnapshot,
) {
  const childSessionTabs = useMemo(
    () =>
      snapshot.childSessionTabs.filter(
        (tab) => tab.parentSessionKey === snapshot.sessionKey,
      ),
    [snapshot.childSessionTabs, snapshot.sessionKey],
  );
  const workspaceFileTabs = useMemo(
    () =>
      snapshot.workspaceFileTabs.filter(
        (tab) => tab.parentSessionKey === snapshot.sessionKey,
      ),
    [snapshot.sessionKey, snapshot.workspaceFileTabs],
  );
  const cronQuery = useCronJobs({ all: true });
  const sessionCronJobs = useMemo(
    () =>
      (cronQuery.data?.jobs ?? []).filter((job) =>
        isCronJobForSession(job, snapshot.sessionKey),
      ),
    [cronQuery.data?.jobs, snapshot.sessionKey],
  );

  return {
    childSessionTabs,
    workspaceFileTabs,
    sessionCronJobs,
    showWorkspacePanel: shouldShowWorkspacePanel(
      snapshot,
      childSessionTabs,
      workspaceFileTabs,
      sessionCronJobs.length,
    ),
  };
}
