export const PROJECT_OBSERVATION_PROTOCOL = "nextclaw.project/v1" as const;

export type ProjectObservationDataQuality = "complete" | "partial" | "unavailable";
export type ProjectObservationEvidenceKind =
  | "project-config"
  | "file-observation"
  | "ai-report"
  | "system-record";

export type ProjectObservationReference = {
  kind: ProjectObservationEvidenceKind;
  label: string;
  observedAt: string;
  projectRelativePath?: string;
  sessionId?: string;
  messageId?: string;
};

export type ProjectObservationDiagnostic = {
  id: string;
  source: "config" | "files" | "sessions" | "skills";
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  projectRelativePath?: string;
  sessionId?: string;
  messageId?: string;
};

export type ProjectObservationSourceStatus = {
  id: "config" | "files" | "sessions" | "skills";
  label: string;
  status: "available" | "empty" | "error";
  itemCount: number;
  observedAt: string;
  diagnosticIds: string[];
};

export type ObservedProjectContextReference = {
  id: string;
  role: string;
  source: string;
  accessible: boolean;
  reference: ProjectObservationReference;
};

export type ObservedProjectContext = {
  name: string;
  rootPath: string;
  summary?: string;
  context: ObservedProjectContextReference[];
};

export type ObservedWorkflowStage = {
  id: string;
  label: string;
};

export type ObservedWorkflow = {
  id: string;
  label: string;
  stages: ObservedWorkflowStage[];
  reference: ProjectObservationReference;
};

export type ObservedWorkItemSchedule = {
  start?: string;
  end?: string;
  milestone: boolean;
  dependsOn: string[];
};

export type ObservedWorkItem = {
  id: string;
  name: string;
  status: "active" | "blocked" | "completed" | "cancelled";
  workflowId?: string;
  stageId?: string;
  schedule?: ObservedWorkItemSchedule;
  updatedAt: string;
  reference: ProjectObservationReference;
};

export type ObservedProjectRun = {
  sessionId: string;
  state: "running" | "completed" | "failed" | "cancelled" | "idle";
  updatedAt: string;
  agentId?: string;
  model?: string;
  label?: string;
  statusText?: string;
  workItemId?: string;
  reference: ProjectObservationReference;
};

export type ObservedArtifact = {
  id: string;
  path: string;
  categoryId: string;
  categoryLabel: string;
  exists: boolean;
  itemId?: string;
  size?: number;
  fileCreatedAt?: string;
  fileUpdatedAt?: string;
  references: ProjectObservationReference[];
};

export type ObservedArtifactCategory = {
  id: string;
  label: string;
};

export type ObservedSignal = {
  id: string;
  itemId?: string;
  status: "open" | "resolved";
  level: "info" | "attention" | "warning";
  message: string;
  updatedAt: string;
  reference: ProjectObservationReference;
};

export type ObservedRequest = {
  id: string;
  itemId?: string;
  status: "open" | "resolved" | "expired";
  response: "confirm-reject" | "open-session";
  prompt: string;
  updatedAt: string;
  reply?: {
    decision: "confirmed" | "rejected";
    sentAt: string;
    messageId: string;
  };
  reference: ProjectObservationReference;
};

export type ObservedActivity = {
  id: string;
  kind: "work-item" | "artifact" | "schedule" | "signal" | "request";
  message: string;
  at: string;
  itemId?: string;
  reference: ProjectObservationReference;
};

export type ObservedSkill = {
  ref: string;
  name: string;
  description?: string;
  source: "project";
  path: string;
  readable: boolean;
  reference: ProjectObservationReference;
};

export type ProjectObservationSnapshot = {
  asOf: string;
  project: ObservedProjectContext;
  sources: ProjectObservationSourceStatus[];
  workflows: ObservedWorkflow[];
  runs: ObservedProjectRun[];
  workItems: ObservedWorkItem[];
  artifactCategories: ObservedArtifactCategory[];
  artifacts: ObservedArtifact[];
  signals: ObservedSignal[];
  requests: ObservedRequest[];
  activity: ObservedActivity[];
  skills: ObservedSkill[];
  diagnostics: ProjectObservationDiagnostic[];
  dataQuality: ProjectObservationDataQuality;
};

export class ProjectObservationError extends Error {
  constructor(
    readonly code: "PROJECT_NOT_REGISTERED" | "PROJECT_OBSERVATION_INVALID_ROOT",
    message: string,
  ) {
    super(message);
    this.name = "ProjectObservationError";
  }
}

export function isProjectObservationError(error: unknown): error is ProjectObservationError {
  return error instanceof ProjectObservationError;
}
