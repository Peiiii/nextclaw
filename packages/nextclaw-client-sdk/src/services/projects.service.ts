import type {
  ProjectAddExistingRequest,
  ProjectAgreementMaterial,
  ProjectCreateRequest,
  ProjectListView,
  ProjectSkillMaterial,
  ProjectView,
  CreateProjectWorkItemInput,
  CreateProjectWorkStateInput,
  ProjectWorkActivityPage,
  ProjectWorkArtifactLink,
  ProjectWorkItemDetail,
  ProjectWorkItemPage,
  ProjectWorkListInput,
  ProjectRecentArtifactPage,
  ProjectWorkState,
  ProjectWorkSummary,
  UpdateProjectWorkItemInput,
  UpdateProjectWorkStateInput,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class ProjectsService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<ProjectListView> =>
    await this.requestService.get<ProjectListView>("/api/projects");

  readonly getAgreement = async (
    projectId: string,
  ): Promise<ProjectAgreementMaterial> =>
    await this.requestService.get<ProjectAgreementMaterial>(
      `/api/projects/${encodeURIComponent(projectId)}/agreement`,
    );

  readonly listProjectSkills = async (
    projectId: string,
  ): Promise<ProjectSkillMaterial[]> =>
    await this.requestService.get<ProjectSkillMaterial[]>(
      `/api/projects/${encodeURIComponent(projectId)}/skills`,
    );

  readonly create = async (input: ProjectCreateRequest): Promise<ProjectView> =>
    await this.requestService.post<ProjectView>("/api/projects", input);

  readonly addExisting = async (
    input: ProjectAddExistingRequest,
  ): Promise<ProjectView> =>
    await this.requestService.post<ProjectView>(
      "/api/projects/existing",
      input,
    );

  readonly remove = async (
    projectId: string,
    confirmProjectId: string,
  ): Promise<ProjectView> =>
    await this.requestService.request<ProjectView>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: "DELETE",
        body: { confirmProjectId },
      },
    );

  readonly listWork = async (
    projectId: string,
    input: Omit<ProjectWorkListInput, "projectId"> = {},
  ): Promise<ProjectWorkItemPage> =>
    await this.requestService.get<ProjectWorkItemPage>(
      `/api/projects/${encodeURIComponent(projectId)}/work`,
      { query: input },
    );

  readonly listRecentWorkArtifacts = async (
    projectId: string,
    input: { cursor?: string; limit?: number; query?: string } = {},
  ): Promise<ProjectRecentArtifactPage> =>
    await this.requestService.get<ProjectRecentArtifactPage>(
      `/api/projects/${encodeURIComponent(projectId)}/work/artifacts`,
      { query: input },
    );

  readonly getWorkSummary = async (
    projectId: string,
  ): Promise<ProjectWorkSummary> =>
    await this.requestService.get<ProjectWorkSummary>(
      `/api/projects/${encodeURIComponent(projectId)}/work/summary`,
    );

  readonly getWorkItem = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkItemDetail> =>
    await this.requestService.get<ProjectWorkItemDetail>(
      workItemPath(projectId, workItemId),
    );

  readonly createWorkItem = async (
    projectId: string,
    input: CreateProjectWorkItemInput,
  ): Promise<ProjectWorkItemDetail> =>
    await this.requestService.post<ProjectWorkItemDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/work/items`,
      input,
    );

  readonly updateWorkItem = async (
    projectId: string,
    workItemId: string,
    input: UpdateProjectWorkItemInput,
  ): Promise<ProjectWorkItemDetail> =>
    await this.requestService.patch<ProjectWorkItemDetail>(
      workItemPath(projectId, workItemId),
      input,
    );

  readonly deleteWorkItem = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkItemDetail> =>
    await this.requestService.delete<ProjectWorkItemDetail>(
      workItemPath(projectId, workItemId),
    );

  readonly restoreWorkItem = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkItemDetail> =>
    await this.requestService.post<ProjectWorkItemDetail>(
      `${workItemPath(projectId, workItemId)}/restore`,
    );

  readonly listWorkItemActivities = async (
    projectId: string,
    workItemId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<ProjectWorkActivityPage> =>
    await this.requestService.get<ProjectWorkActivityPage>(
      `${workItemPath(projectId, workItemId)}/activities`,
      { query: options },
    );

  readonly linkWorkItemArtifact = async (
    projectId: string,
    workItemId: string,
    input: { path: string; label?: string },
  ): Promise<ProjectWorkArtifactLink> =>
    await this.requestService.post<ProjectWorkArtifactLink>(
      `${workItemPath(projectId, workItemId)}/artifacts`,
      input,
    );

  readonly unlinkWorkItemArtifact = async (
    projectId: string,
    workItemId: string,
    artifactLinkId: string,
  ): Promise<{ removed: true }> =>
    await this.requestService.delete<{ removed: true }>(
      `${workItemPath(projectId, workItemId)}/artifacts/${encodeURIComponent(artifactLinkId)}`,
    );

  readonly listWorkStates = async (
    projectId: string,
  ): Promise<ProjectWorkState[]> =>
    await this.requestService.get<ProjectWorkState[]>(
      `/api/projects/${encodeURIComponent(projectId)}/work/states`,
    );

  readonly createWorkState = async (
    projectId: string,
    input: CreateProjectWorkStateInput,
  ): Promise<ProjectWorkState> =>
    await this.requestService.post<ProjectWorkState>(
      `/api/projects/${encodeURIComponent(projectId)}/work/states`,
      input,
    );

  readonly updateWorkState = async (
    projectId: string,
    stateId: string,
    input: UpdateProjectWorkStateInput,
  ): Promise<ProjectWorkState> =>
    await this.requestService.patch<ProjectWorkState>(
      workStatePath(projectId, stateId),
      input,
    );

  readonly deleteWorkState = async (
    projectId: string,
    stateId: string,
    migrateToStateId?: string | null,
  ): Promise<{ removed: true }> =>
    await this.requestService.request<{ removed: true }>(
      workStatePath(projectId, stateId),
      {
        method: "DELETE",
        body: { migrateToStateId: migrateToStateId ?? null },
      },
    );
}

function workItemPath(projectId: string, workItemId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/work/items/${encodeURIComponent(workItemId)}`;
}

function workStatePath(projectId: string, stateId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/work/states/${encodeURIComponent(stateId)}`;
}
