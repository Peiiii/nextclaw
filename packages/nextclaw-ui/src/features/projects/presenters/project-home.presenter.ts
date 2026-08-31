import type {
  ObservedRequest,
  ObservedWorkItem,
  ObservedWorkflow,
  ProjectObservationSnapshot,
} from "@nextclaw/client-sdk";

export type ProjectHomeTab = "overview" | "work" | "artifacts" | "skills" | "agreement";
export type ProjectWorkView = "list" | "board" | "gantt";

export type ProjectBoardColumn = {
  id: string;
  label: string;
  items: ObservedWorkItem[];
};

export function isProjectHomeTab(value: string | undefined): value is ProjectHomeTab {
  return value === "overview" || value === "work" || value === "artifacts" || value === "skills" || value === "agreement";
}

export function createProjectBoardColumns(
  workflows: readonly ObservedWorkflow[],
  workItems: readonly ObservedWorkItem[],
): ProjectBoardColumn[] {
  return workflows.flatMap((workflow) => workflow.stages.map((stage) => ({
    id: `${workflow.id}:${stage.id}`,
    label: stage.label,
    items: workItems.filter((item) => (
      item.workflowId === workflow.id && item.stageId === stage.id
    )),
  })));
}

export function getUnstagedWorkItems(
  workItems: readonly ObservedWorkItem[],
): ObservedWorkItem[] {
  return workItems.filter((item) => !item.workflowId || !item.stageId);
}

export function getScheduledWorkItems(
  workItems: readonly ObservedWorkItem[],
): ObservedWorkItem[] {
  return workItems.filter((item) => item.schedule?.start || item.schedule?.end);
}

export function canReplyToProjectRequest(request: ObservedRequest): boolean {
  return request.status === "open"
    && request.response === "confirm-reject"
    && Boolean(request.reference.sessionId)
    && !request.reply;
}

export function getOpenProjectRequests(snapshot: ProjectObservationSnapshot): ObservedRequest[] {
  return snapshot.requests.filter((request) => request.status === "open");
}
