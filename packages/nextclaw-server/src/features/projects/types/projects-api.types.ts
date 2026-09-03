import type {
  ProjectRecord,
  ProjectTemplate,
  ProjectTemplateId,
} from "@nextclaw/kernel";

export type {
  ObservedProjectRun,
  ProjectObservationSnapshot,
} from "@nextclaw/kernel";

export type {
  CreateProjectWorkItemInput,
  CreateProjectWorkStateInput,
  ProjectWorkActivity,
  ProjectWorkActivityPage,
  ProjectWorkArtifactLink,
  ProjectWorkAttention,
  ProjectWorkItemDetail,
  ProjectWorkItemListEntry,
  ProjectWorkItemPage,
  ProjectWorkListInput,
  ProjectRecentArtifact,
  ProjectRecentArtifactPage,
  ProjectWorkState,
  ProjectWorkStateCategory,
  ProjectWorkSummary,
  UpdateProjectWorkItemInput,
  UpdateProjectWorkStateInput,
} from "@nextclaw/kernel";

export type ProjectView = ProjectRecord;
export type ProjectTemplateView = ProjectTemplate;

export type ProjectListView = {
  projects: ProjectView[];
  templates: ProjectTemplateView[];
  total: number;
};
export type ProjectCreateRequest = {
  name: string;
  rootPath?: string;
  template?: ProjectTemplateId;
};
export type ProjectAddExistingRequest = {
  rootPath: string;
};
