export type ProjectObservationDataQuality = "complete" | "partial" | "unavailable";
export type ProjectObservationEvidenceKind =
  | "project-config"
  | "file-observation"
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

export type ObservedProjectRun = {
  sessionId: string;
  state: "running" | "completed" | "failed" | "cancelled" | "idle";
  updatedAt: string;
  agentId?: string;
  model?: string;
  label?: string;
  statusText?: string;
  reference: ProjectObservationReference;
};

export type ObservedArtifact = {
  id: string;
  path: string;
  categoryId: string;
  categoryLabel: string;
  exists: boolean;
  size?: number;
  fileCreatedAt?: string;
  fileUpdatedAt?: string;
  references: ProjectObservationReference[];
};

export type ObservedArtifactCategory = {
  id: string;
  label: string;
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
  runs: ObservedProjectRun[];
  artifactCategories: ObservedArtifactCategory[];
  artifacts: ObservedArtifact[];
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
