import type { NcpSessionSummary } from "@nextclaw/ncp";
import type {
  ObservedActivity,
  ObservedArtifact,
  ObservedProjectRun,
  ObservedRequest,
  ObservedSignal,
  ObservedWorkItem,
  ProjectObservationDiagnostic,
  ProjectObservationReference,
  ProjectObservationSnapshot,
} from "@kernel/features/projects/types/project-observation.types.js";
import type { ProjectObservationConfig } from "@kernel/features/projects/utils/project-observation-config.utils.js";
import {
  normalizeProjectRelativePath,
  observeProjectFile,
} from "@kernel/features/projects/utils/project-observation-files.utils.js";
import type { ProjectObservationMarker } from "@kernel/features/projects/utils/project-observation-marker.utils.js";

type DiagnosticSource = ProjectObservationDiagnostic["source"];

type ProjectObservationDiagnosticReporter = (
  source: DiagnosticSource,
  level: ProjectObservationDiagnostic["level"],
  code: string,
  message: string,
  details?: Pick<ProjectObservationDiagnostic, "projectRelativePath" | "sessionId" | "messageId">,
) => void;

export const projectObservationConfigReference = (asOf: string): ProjectObservationReference => ({
  kind: "project-config",
  label: "项目配置",
  observedAt: asOf,
  projectRelativePath: ".nextclaw/project.yaml",
});

export const projectObservationFileReference = (
  path: string,
  observedAt: string,
): ProjectObservationReference => ({
  kind: "file-observation",
  label: "文件观测",
  observedAt,
  projectRelativePath: path,
});

const markerReference = (marker: ProjectObservationMarker): ProjectObservationReference => ({
  kind: "ai-report",
  label: "AI 报告",
  observedAt: marker.timestamp,
  sessionId: marker.sessionId,
  messageId: marker.messageId,
});

const markerActivityMessage = (marker: ProjectObservationMarker): string => {
  switch (marker.kind) {
    case "work-item": return `AI 报告工作项“${marker.name}”为 ${marker.status}`;
    case "artifact": return `AI 报告产物 ${marker.path}`;
    case "schedule": return `AI 报告 ${marker.itemId} 的计划信息`;
    case "signal": return marker.message;
    case "request": return marker.prompt;
  }
};

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readProjectRunState = (
  session: NcpSessionSummary,
): ObservedProjectRun["state"] => {
  const state = (session.metadata?.last_activity_preview as { state?: unknown } | undefined)?.state;
  if (state === "running" || state === "completed" || state === "failed" || state === "cancelled" || state === "idle") {
    return state;
  }
  return session.status === "running" ? "running" : "idle";
};

export function projectObservedRuns(
  sessions: NcpSessionSummary[],
  markers: ProjectObservationMarker[],
): ObservedProjectRun[] {
  const latestWorkItemIdBySession = new Map<string, string>();
  for (const marker of markers) {
    if (marker.kind === "work-item") {
      latestWorkItemIdBySession.set(marker.sessionId, marker.id);
    }
  }
  return sessions.map((session) => {
    const preview = session.metadata?.last_activity_preview as {
      timestamp?: unknown;
      statusText?: unknown;
    } | undefined;
    const updatedAt = readOptionalString(preview?.timestamp)
      ?? session.lastMessageAt
      ?? session.updatedAt;
    const model = readOptionalString(session.metadata?.preferred_model)
      ?? readOptionalString(session.metadata?.preferredModel)
      ?? readOptionalString(session.metadata?.model);
    const label = readOptionalString(session.metadata?.label);
    const statusText = readOptionalString(preview?.statusText);
    const workItemId = latestWorkItemIdBySession.get(session.sessionId);
    return {
      sessionId: session.sessionId,
      state: readProjectRunState(session),
      updatedAt,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      ...(model ? { model } : {}),
      ...(label ? { label } : {}),
      ...(statusText ? { statusText } : {}),
      ...(workItemId ? { workItemId } : {}),
      reference: {
        kind: "system-record" as const,
        label: "会话运行",
        observedAt: updatedAt,
        sessionId: session.sessionId,
      },
    };
  }).sort((left, right) => {
    const runningOrder = Number(right.state === "running") - Number(left.state === "running");
    return runningOrder || right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function projectObservedWorkItems(
  markers: ProjectObservationMarker[],
  workflows: ProjectObservationSnapshot["workflows"],
  addDiagnostic: ProjectObservationDiagnosticReporter,
): ObservedWorkItem[] {
  const workItems = new Map<string, Extract<ProjectObservationMarker, { kind: "work-item" }>>();
  const schedules = new Map<string, Extract<ProjectObservationMarker, { kind: "schedule" }>>();
  for (const marker of markers) {
    if (marker.kind === "work-item") workItems.set(marker.id, marker);
    if (marker.kind === "schedule") schedules.set(marker.itemId, marker);
  }
  return [...workItems.values()].map((marker) => {
    const inferredWorkflows = marker.stageId
      ? workflows.filter((entry) => entry.stages.some((stage) => stage.id === marker.stageId))
      : [];
    const workflow = marker.workflowId
      ? workflows.find((entry) => entry.id === marker.workflowId)
      : inferredWorkflows.length === 1
        ? inferredWorkflows[0]
        : undefined;
    if (marker.workflowId && !workflow) {
      addDiagnostic("sessions", "warning", "PROJECT_MARKER_WORKFLOW_UNKNOWN", `Work item '${marker.id}' references unknown workflow '${marker.workflowId}'.`, { sessionId: marker.sessionId, messageId: marker.messageId });
    }
    if (marker.stageId && (!workflow || !workflow.stages.some((stage) => stage.id === marker.stageId))) {
      addDiagnostic("sessions", "warning", "PROJECT_MARKER_STAGE_UNKNOWN", `Work item '${marker.id}' references unknown stage '${marker.stageId}'.`, { sessionId: marker.sessionId, messageId: marker.messageId });
    }
    const schedule = schedules.get(marker.id);
    return {
      id: marker.id,
      name: marker.name,
      status: marker.status,
      ...(workflow ? { workflowId: workflow.id } : {}),
      ...(workflow && marker.stageId && workflow.stages.some((stage) => stage.id === marker.stageId) ? { stageId: marker.stageId } : {}),
      ...(schedule ? {
        schedule: {
          ...(schedule.start ? { start: schedule.start } : {}),
          ...(schedule.end ? { end: schedule.end } : {}),
          milestone: schedule.milestone,
          dependsOn: schedule.dependsOn,
        },
      } : {}),
      updatedAt: marker.timestamp,
      reference: markerReference(marker),
    };
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function mergeProjectObservedArtifacts(
  rootPath: string,
  observed: ObservedArtifact[],
  config: ProjectObservationConfig | null,
  markers: ProjectObservationMarker[],
  addDiagnostic: ProjectObservationDiagnosticReporter,
): Promise<ObservedArtifact[]> {
  const artifacts = new Map(observed.map((artifact) => [`${artifact.categoryId}:${artifact.path}`, artifact]));
  for (const marker of markers) {
    if (marker.kind !== "artifact") continue;
    const category = config?.artifactCategories.find((entry) => entry.id === marker.categoryId);
    const path = normalizeProjectRelativePath(marker.path);
    const file = path ? await observeProjectFile(rootPath, path) : null;
    if (!category) {
      addDiagnostic("sessions", "warning", "PROJECT_MARKER_CATEGORY_UNKNOWN", `Artifact marker references unknown category '${marker.categoryId}'.`, { sessionId: marker.sessionId, messageId: marker.messageId });
    }
    if (!file) {
      addDiagnostic("files", "warning", "PROJECT_MARKER_ARTIFACT_UNAVAILABLE", `Artifact '${marker.path}' is missing or outside the project.`, { projectRelativePath: marker.path, sessionId: marker.sessionId, messageId: marker.messageId });
    }
    const normalizedPath = path ?? marker.path;
    const key = `${marker.categoryId}:${normalizedPath}`;
    const existing = artifacts.get(key);
    if (existing) {
      artifacts.set(key, {
        ...existing,
        itemId: marker.itemId,
        references: [...existing.references, markerReference(marker)],
      });
      continue;
    }
    artifacts.set(key, {
      id: key,
      path: normalizedPath,
      categoryId: marker.categoryId,
      categoryLabel: category?.label ?? marker.categoryId,
      exists: file !== null,
      itemId: marker.itemId,
      ...(file ? {
        size: file.size,
        fileCreatedAt: file.createdAt,
        fileUpdatedAt: file.updatedAt,
      } : {}),
      references: [markerReference(marker), ...(file ? [projectObservationFileReference(file.relativePath, file.updatedAt)] : [])],
    });
  }
  return [...artifacts.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function projectObservedSignals(markers: ProjectObservationMarker[]): ObservedSignal[] {
  const signals = new Map<string, Extract<ProjectObservationMarker, { kind: "signal" }>>();
  for (const marker of markers) {
    if (marker.kind === "signal") signals.set(marker.id, marker);
  }
  return [...signals.values()].map((marker) => ({
    id: marker.id,
    ...(marker.itemId ? { itemId: marker.itemId } : {}),
    status: marker.status,
    level: marker.level,
    message: marker.message,
    updatedAt: marker.timestamp,
    reference: markerReference(marker),
  })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function projectObservedRequests(
  markers: ProjectObservationMarker[],
  responses: Map<string, { decision: "confirmed" | "rejected"; sentAt: string; messageId: string }>,
): ObservedRequest[] {
  const requests = new Map<string, Extract<ProjectObservationMarker, { kind: "request" }>>();
  for (const marker of markers) {
    if (marker.kind === "request") requests.set(marker.id, marker);
  }
  return [...requests.values()].map((marker) => ({
    id: marker.id,
    ...(marker.itemId ? { itemId: marker.itemId } : {}),
    status: marker.status,
    response: marker.response,
    prompt: marker.prompt,
    updatedAt: marker.timestamp,
    ...(responses.get(marker.id) ? { reply: responses.get(marker.id)! } : {}),
    reference: markerReference(marker),
  })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export const projectObservedActivity = (markers: ProjectObservationMarker[]): ObservedActivity[] => markers
  .map((marker) => ({
    id: `${marker.messageId}:${marker.line}:${marker.kind}`,
    kind: marker.kind,
    message: markerActivityMessage(marker),
    at: marker.timestamp,
    ...(marker.kind === "work-item" ? { itemId: marker.id } : marker.kind === "artifact" || marker.kind === "schedule" ? { itemId: marker.itemId } : marker.itemId ? { itemId: marker.itemId } : {}),
    reference: markerReference(marker),
  }))
  .sort((left, right) => right.at.localeCompare(left.at));
