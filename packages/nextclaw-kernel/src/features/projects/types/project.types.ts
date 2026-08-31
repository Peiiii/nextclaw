export const PROJECT_TEMPLATE_IDS = ["empty", "knowledge-base"] as const;

export type ProjectTemplateId = (typeof PROJECT_TEMPLATE_IDS)[number];

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
};
export type ProjectRecord = {
  id: string;
  name: string;
  rootPath: string;
  template?: ProjectTemplateId;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  rootPath?: string;
  template?: ProjectTemplateId;
};

export type ProjectSessionBinding = {
  projectId: string;
  rootPath: string;
};
