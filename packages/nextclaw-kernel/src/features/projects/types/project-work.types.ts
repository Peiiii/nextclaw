export const PROJECT_WORK_STATE_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;

export type ProjectWorkStateCategory =
  (typeof PROJECT_WORK_STATE_CATEGORIES)[number];

export const PROJECT_WORK_ATTENTION_VALUES = [
  "none",
  "blocked",
  "awaiting-user",
] as const;

export type ProjectWorkAttention =
  (typeof PROJECT_WORK_ATTENTION_VALUES)[number];

export type ProjectWorkActor = {
  kind: "agent" | "cli" | "system" | "user";
  id?: string;
  sessionId?: string;
};

export type ProjectWorkState = {
  id: string;
  projectId: string;
  name: string;
  category: ProjectWorkStateCategory;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectWorkItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  stateId: string;
  attention: ProjectWorkAttention;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ProjectWorkActivityType =
  | "artifact-linked"
  | "artifact-unlinked"
  | "created"
  | "deleted"
  | "restored"
  | "state-changed"
  | "updated";

export type ProjectWorkActivity = {
  id: string;
  projectId: string;
  workItemId: string;
  type: ProjectWorkActivityType;
  actor: ProjectWorkActor;
  details: Record<string, unknown>;
  createdAt: string;
};

export type ProjectWorkArtifactLink = {
  id: string;
  projectId: string;
  workItemId: string;
  path: string;
  label: string | null;
  createdAt: string;
};

export type ProjectWorkItemDetail = ProjectWorkItem & {
  state: ProjectWorkState;
  artifacts: ProjectWorkArtifactLink[];
};

export type ProjectWorkItemListEntry = ProjectWorkItem & {
  state: ProjectWorkState;
  artifactCount: number;
};

export type ProjectWorkListInput = {
  stateId?: string;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
};

export type ProjectWorkItemPage = {
  items: ProjectWorkItemListEntry[];
  nextCursor: string | null;
  total: number;
};

export type ProjectRecentArtifact = {
  id: string;
  path: string;
  label: string | null;
  workItemId: string;
  workItemTitle: string;
  createdAt: string;
  exists: boolean;
};

export type ProjectRecentArtifactPage = {
  artifacts: ProjectRecentArtifact[];
  nextCursor: string | null;
  total: number;
};

export type ProjectWorkSummary = {
  active: number;
  attention: number;
  completed: number;
  total: number;
  updatedAt: string | null;
};

export type ProjectWorkActivityPage = {
  activities: ProjectWorkActivity[];
  nextCursor: string | null;
};

export type CreateProjectWorkItemInput = {
  title: string;
  description?: string;
  stateId?: string;
  attention?: ProjectWorkAttention;
};

export type UpdateProjectWorkItemInput = {
  title?: string;
  description?: string;
  stateId?: string;
  attention?: ProjectWorkAttention;
  expectedVersion?: number;
};

export type CreateProjectWorkStateInput = {
  name: string;
  category: ProjectWorkStateCategory;
  position?: number;
  isDefault?: boolean;
};

export type UpdateProjectWorkStateInput = {
  name?: string;
  category?: ProjectWorkStateCategory;
  position?: number;
  isDefault?: boolean;
};
