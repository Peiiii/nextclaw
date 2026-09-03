import { useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateProjectWorkItemInput,
  CreateProjectWorkStateInput,
  ProjectWorkState,
  ProjectWorkListInput,
  UpdateProjectWorkItemInput,
  UpdateProjectWorkStateInput,
} from "@nextclaw/client-sdk";
import { eventKeys } from "@nextclaw/client-sdk";
import { nextclawClient } from "@/shared/lib/api";

export const projectWorkQueryKey = (projectId: string) =>
  ["project-work", projectId] as const;
export const projectWorkSummaryQueryKey = (projectId: string) =>
  ["project-work-summary", projectId] as const;
export const projectWorkStatesQueryKey = (projectId: string) =>
  ["project-work-states", projectId] as const;
export const projectWorkArtifactsQueryKey = (projectId: string) =>
  ["project-work-artifacts", projectId] as const;
export const projectWorkItemQueryKey = (
  projectId: string,
  workItemId: string,
) => ["project-work-item", projectId, workItemId] as const;
export const projectWorkActivityQueryKey = (
  projectId: string,
  workItemId: string,
) => ["project-work-activity", projectId, workItemId] as const;

export function useProjectWork(
  projectId: string | null,
  input: Omit<ProjectWorkListInput, "cursor"> = {},
) {
  return useInfiniteQuery({
    queryKey: [...projectWorkQueryKey(projectId ?? ""), input],
    enabled: Boolean(projectId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      await nextclawClient.projects.listWork(projectId!, {
        ...input,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useProjectWorkSummary(projectId: string | null) {
  return useQuery({
    queryKey: projectWorkSummaryQueryKey(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async () =>
      await nextclawClient.projects.getWorkSummary(projectId!),
  });
}

export function useProjectWorkStates(projectId: string | null) {
  return useQuery({
    queryKey: projectWorkStatesQueryKey(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async () =>
      await nextclawClient.projects.listWorkStates(projectId!),
  });
}

export function useProjectRecentArtifacts(projectId: string | null, limit = 5) {
  return useQuery({
    queryKey: [...projectWorkArtifactsQueryKey(projectId ?? ""), limit],
    enabled: Boolean(projectId),
    queryFn: async () =>
      await nextclawClient.projects.listRecentWorkArtifacts(projectId!, {
        limit,
      }),
  });
}

export function useProjectWorkItem(
  projectId: string | null,
  workItemId: string | null,
) {
  return useQuery({
    queryKey: projectWorkItemQueryKey(projectId ?? "", workItemId ?? ""),
    enabled: Boolean(projectId && workItemId),
    queryFn: async () =>
      await nextclawClient.projects.getWorkItem(projectId!, workItemId!),
  });
}

export function useProjectWorkActivity(
  projectId: string | null,
  workItemId: string | null,
) {
  return useQuery({
    queryKey: projectWorkActivityQueryKey(projectId ?? "", workItemId ?? ""),
    enabled: Boolean(projectId && workItemId),
    queryFn: async () =>
      await nextclawClient.projects.listWorkItemActivities(
        projectId!,
        workItemId!,
        { limit: 100 },
      ),
  });
}

export function useProjectWorkActions(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = async (workItemId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: projectWorkQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: projectWorkSummaryQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: projectWorkStatesQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: projectWorkArtifactsQueryKey(projectId),
      }),
      ...(workItemId
        ? [
            queryClient.invalidateQueries({
              queryKey: projectWorkItemQueryKey(projectId, workItemId),
            }),
            queryClient.invalidateQueries({
              queryKey: projectWorkActivityQueryKey(projectId, workItemId),
            }),
          ]
        : []),
    ]);
  };
  return {
    createItem: useMutation({
      mutationFn: async (input: CreateProjectWorkItemInput) =>
        await nextclawClient.projects.createWorkItem(projectId, input),
      onSuccess: async (item) => await refresh(item.id),
    }),
    updateItem: useMutation({
      mutationFn: async (input: {
        workItemId: string;
        patch: UpdateProjectWorkItemInput;
      }) =>
        await nextclawClient.projects.updateWorkItem(
          projectId,
          input.workItemId,
          input.patch,
        ),
      onSuccess: async (item) => await refresh(item.id),
    }),
    deleteItem: useMutation({
      mutationFn: async (workItemId: string) =>
        await nextclawClient.projects.deleteWorkItem(projectId, workItemId),
      onSuccess: async (item) => await refresh(item.id),
    }),
    restoreItem: useMutation({
      mutationFn: async (workItemId: string) =>
        await nextclawClient.projects.restoreWorkItem(projectId, workItemId),
      onSuccess: async (item) => await refresh(item.id),
    }),
    linkArtifact: useMutation({
      mutationFn: async (input: {
        workItemId: string;
        path: string;
        label?: string;
      }) =>
        await nextclawClient.projects.linkWorkItemArtifact(
          projectId,
          input.workItemId,
          { path: input.path, ...(input.label ? { label: input.label } : {}) },
        ),
      onSuccess: async (_link, input) => await refresh(input.workItemId),
    }),
    unlinkArtifact: useMutation({
      mutationFn: async (input: {
        workItemId: string;
        artifactLinkId: string;
      }) =>
        await nextclawClient.projects.unlinkWorkItemArtifact(
          projectId,
          input.workItemId,
          input.artifactLinkId,
        ),
      onSuccess: async (_result, input) => await refresh(input.workItemId),
    }),
    createState: useMutation({
      mutationFn: async (input: CreateProjectWorkStateInput) =>
        await nextclawClient.projects.createWorkState(projectId, input),
      onSuccess: async () => await refresh(),
    }),
    updateState: useMutation({
      mutationFn: async (input: {
        stateId: string;
        patch: UpdateProjectWorkStateInput;
      }) =>
        await nextclawClient.projects.updateWorkState(
          projectId,
          input.stateId,
          input.patch,
        ),
      onSuccess: async () => await refresh(),
    }),
    deleteState: useMutation({
      mutationFn: async (input: {
        stateId: string;
        migrateToStateId?: string | null;
      }) =>
        await nextclawClient.projects.deleteWorkState(
          projectId,
          input.stateId,
          input.migrateToStateId,
        ),
      onSuccess: async () => await refresh(),
    }),
  };
}

export function useProjectWorkEvents(projectId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!projectId) return;
    return nextclawClient.eventBus.on(eventKeys.projectWorkChanged, (event) => {
      if (event.projectId !== projectId) return;
      void queryClient.invalidateQueries({
        queryKey: projectWorkQueryKey(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectWorkSummaryQueryKey(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectWorkStatesQueryKey(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectWorkArtifactsQueryKey(projectId),
      });
      if (event.workItemId) {
        void queryClient.invalidateQueries({
          queryKey: projectWorkItemQueryKey(projectId, event.workItemId),
        });
        void queryClient.invalidateQueries({
          queryKey: projectWorkActivityQueryKey(projectId, event.workItemId),
        });
      }
    });
  }, [projectId, queryClient]);
}

export function sortProjectWorkStates(
  states: ProjectWorkState[],
): ProjectWorkState[] {
  return [...states].sort(
    (left, right) =>
      left.position - right.position || left.name.localeCompare(right.name),
  );
}

const LIST_CATEGORY_ORDER: Readonly<
  Record<ProjectWorkState["category"], number>
> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4,
};

export function sortProjectWorkStatesForList(
  states: ProjectWorkState[],
): ProjectWorkState[] {
  return [...states].sort((left, right) => {
    const categoryOrder =
      LIST_CATEGORY_ORDER[left.category] - LIST_CATEGORY_ORDER[right.category];
    if (categoryOrder !== 0) return categoryOrder;
    if (left.category === "completed" || left.category === "canceled") {
      return (
        left.position - right.position || left.name.localeCompare(right.name)
      );
    }
    return (
      right.position - left.position || left.name.localeCompare(right.name)
    );
  });
}
