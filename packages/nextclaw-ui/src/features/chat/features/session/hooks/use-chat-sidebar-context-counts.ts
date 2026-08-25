import { useMemo } from "react";
import { useCronJobs } from "@/features/cron";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";

export function useChatSidebarContextCounts(
  allItems: readonly NcpSessionListItemView[],
) {
  const cronQuery = useCronJobs({ all: true });

  return useMemo(() => {
    const projectRootBySessionKey = new Map(
      allItems.flatMap(({ session }) => {
        const projectRoot = session.projectRoot?.trim();
        return projectRoot ? [[session.key, projectRoot] as const] : [];
      }),
    );
    const cronJobCountBySessionKey = new Map<string, number>();
    const cronJobCountByProjectRoot = new Map<string, number>();

    for (const job of cronQuery.data?.jobs ?? []) {
      const sessionKey = job.payload.sessionId?.trim();
      if (!sessionKey) {
        continue;
      }
      cronJobCountBySessionKey.set(
        sessionKey,
        (cronJobCountBySessionKey.get(sessionKey) ?? 0) + 1,
      );
      const projectRoot = projectRootBySessionKey.get(sessionKey);
      if (projectRoot) {
        cronJobCountByProjectRoot.set(
          projectRoot,
          (cronJobCountByProjectRoot.get(projectRoot) ?? 0) + 1,
        );
      }
    }

    return { cronJobCountByProjectRoot, cronJobCountBySessionKey };
  }, [allItems, cronQuery.data?.jobs]);
}
