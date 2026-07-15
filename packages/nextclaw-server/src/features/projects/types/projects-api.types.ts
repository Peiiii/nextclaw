import type {
  ProjectRecord,
  ProjectTemplate,
  ProjectTemplateId,
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
