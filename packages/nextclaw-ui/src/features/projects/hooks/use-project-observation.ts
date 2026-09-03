import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  eventKeys,
  type ProjectObservationSnapshot,
} from "@nextclaw/client-sdk";
import { nextclawClient } from "@/shared/lib/api";

export const projectObservationQueryKey = (projectId: string) =>
  ["project-observation", projectId] as const;

const readProjectRoot = (
  metadata: Record<string, unknown> | undefined,
): string | null => {
  const value = metadata?.project_root ?? metadata?.projectRoot;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export function useProjectObservation(
  projectId: string | null,
  projectRoot: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || !projectId || !projectRoot) return;
    const queryKey = projectObservationQueryKey(projectId);
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }, 100);
    };
    const hasObservedSession = (sessionId: string): boolean => {
      const snapshot =
        queryClient.getQueryData<ProjectObservationSnapshot>(queryKey);
      return Boolean(snapshot?.runs.some((run) => run.sessionId === sessionId));
    };
    const unsubscribers = [
      nextclawClient.eventBus.on(
        eventKeys.sessionRunStatus,
        ({ sessionKey }) => {
          if (hasObservedSession(sessionKey)) scheduleRefresh();
        },
      ),
      nextclawClient.eventBus.on(
        eventKeys.sessionSummaryUpsert,
        ({ summary }) => {
          if (readProjectRoot(summary.metadata) === projectRoot)
            scheduleRefresh();
        },
      ),
      nextclawClient.eventBus.on(
        eventKeys.sessionSummaryDelete,
        ({ sessionKey }) => {
          if (hasObservedSession(sessionKey)) scheduleRefresh();
        },
      ),
    ];
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [enabled, projectId, projectRoot, queryClient]);

  return useQuery({
    queryKey: projectObservationQueryKey(projectId ?? ""),
    enabled: enabled && Boolean(projectId),
    staleTime: 5_000,
    queryFn: async () =>
      await nextclawClient.projects.getObservation(projectId!),
  });
}
