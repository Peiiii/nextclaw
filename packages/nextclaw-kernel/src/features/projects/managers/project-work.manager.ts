import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  eventKeys,
  type EventBus,
  type ProjectWorkChangedEventPayload,
} from "@nextclaw/shared";
import { ProjectWorkStore } from "@kernel/features/projects/stores/project-work.store.js";
import { ProjectWorkQueryService } from "@kernel/features/projects/services/project-work-query.service.js";
import { ProjectWorkError } from "@kernel/features/projects/types/project-work-error.types.js";
import {
  PROJECT_WORK_ATTENTION_VALUES,
  PROJECT_WORK_STATE_CATEGORIES,
  type CreateProjectWorkItemInput,
  type CreateProjectWorkStateInput,
  type ProjectWorkActivityPage,
  type ProjectWorkActor,
  type ProjectWorkArtifactLink,
  type ProjectWorkItemDetail,
  type ProjectWorkItemPage,
  type ProjectWorkListInput,
  type ProjectRecentArtifactPage,
  type ProjectWorkState,
  type ProjectWorkSummary,
  type UpdateProjectWorkItemInput,
  type UpdateProjectWorkStateInput,
} from "@kernel/features/projects/types/project-work.types.js";
import type { ProjectManager } from "./project.manager.js";

export class ProjectWorkManager {
  private readonly store: ProjectWorkStore;
  private readonly queries: ProjectWorkQueryService;

  constructor(
    private readonly options: {
      databasePath: string;
      eventBus: EventBus;
      projectManager: ProjectManager;
    },
  ) {
    this.store = new ProjectWorkStore(options.databasePath);
    this.queries = new ProjectWorkQueryService(
      this.store,
      options.projectManager,
    );
  }

  initialize = async (): Promise<void> => {
    await this.store.initialize();
    for (const project of await this.options.projectManager.listProjects()) {
      await this.store.ensureProject(project.id);
    }
  };

  dispose = (): void => this.store.close();

  ensureProject = async (projectId: string): Promise<void> => {
    await this.requireProject(projectId);
    await this.store.ensureProject(projectId);
  };

  list = async (
    projectId: string,
    input: ProjectWorkListInput = {},
  ): Promise<ProjectWorkItemPage> => await this.queries.list(projectId, input);

  summary = async (projectId: string): Promise<ProjectWorkSummary> =>
    await this.queries.summary(projectId);

  listRecentArtifacts = async (
    projectId: string,
    input: { cursor?: string; limit?: number } = {},
  ): Promise<ProjectRecentArtifactPage> =>
    await this.queries.listRecentArtifacts(projectId, input);

  get = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkItemDetail> => {
    await this.ensureProject(projectId);
    const item = await this.store.getItem(projectId, workItemId);
    if (!item)
      throw new ProjectWorkError(
        "PROJECT_WORK_ITEM_NOT_FOUND",
        "work item was not found",
      );
    const state = await this.store.getState(projectId, item.stateId);
    if (!state)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    return {
      ...item,
      state,
      artifacts: await this.store.listArtifacts(projectId, workItemId),
    };
  };

  create = async (
    projectId: string,
    input: CreateProjectWorkItemInput,
    actor: ProjectWorkActor,
  ): Promise<ProjectWorkItemDetail> => {
    await this.ensureProject(projectId);
    const title = this.requireName(input.title, "work item title");
    const attention = input.attention ?? "none";
    this.assertAttention(attention);
    const states = await this.store.listStates(projectId);
    const state = input.stateId
      ? states.find((entry) => entry.id === input.stateId)
      : states.find((entry) => entry.isDefault);
    if (!state)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    const item = await this.store.createItem({
      projectId,
      actor: this.normalizeActor(actor),
      stateId: state.id,
      input: {
        title,
        description: input.description?.trim() ?? "",
        attention,
      },
    });
    await this.emit(projectId, "created", item.id);
    return await this.get(projectId, item.id);
  };

  update = async (
    projectId: string,
    workItemId: string,
    input: UpdateProjectWorkItemInput,
    actor: ProjectWorkActor,
  ): Promise<ProjectWorkItemDetail> => {
    await this.ensureProject(projectId);
    const current = await this.get(projectId, workItemId);
    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== current.version
    ) {
      throw new ProjectWorkError(
        "PROJECT_WORK_VERSION_CONFLICT",
        "work item changed since it was loaded",
      );
    }
    const normalizedInput = {
      ...input,
      ...(input.title !== undefined
        ? { title: this.requireName(input.title, "work item title") }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() }
        : {}),
    };
    if (normalizedInput.attention !== undefined)
      this.assertAttention(normalizedInput.attention);
    if (
      normalizedInput.stateId !== undefined &&
      !(await this.store.getState(projectId, normalizedInput.stateId))
    ) {
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    }
    if (
      (normalizedInput.title === undefined ||
        normalizedInput.title === current.title) &&
      (normalizedInput.description === undefined ||
        normalizedInput.description === current.description) &&
      (normalizedInput.stateId === undefined ||
        normalizedInput.stateId === current.stateId) &&
      (normalizedInput.attention === undefined ||
        normalizedInput.attention === current.attention)
    )
      return current;
    let item;
    try {
      item = await this.store.updateItem({
        projectId,
        workItemId,
        input: normalizedInput,
        actor: this.normalizeActor(actor),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "PROJECT_WORK_VERSION_CONFLICT"
      ) {
        throw new ProjectWorkError(
          "PROJECT_WORK_VERSION_CONFLICT",
          "work item changed since it was loaded",
        );
      }
      throw error;
    }
    if (!item)
      throw new ProjectWorkError(
        "PROJECT_WORK_ITEM_NOT_FOUND",
        "work item was not found",
      );
    await this.emit(projectId, "updated", workItemId);
    return await this.get(projectId, workItemId);
  };

  delete = async (
    projectId: string,
    workItemId: string,
    actor: ProjectWorkActor,
  ): Promise<ProjectWorkItemDetail> => {
    return await this.setDeleted(projectId, workItemId, true, actor);
  };

  restore = async (
    projectId: string,
    workItemId: string,
    actor: ProjectWorkActor,
  ): Promise<ProjectWorkItemDetail> => {
    return await this.setDeleted(projectId, workItemId, false, actor);
  };

  listActivities = async (
    projectId: string,
    workItemId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<ProjectWorkActivityPage> => {
    await this.get(projectId, workItemId);
    if (options.cursor && !/^\d+$/.test(options.cursor)) {
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        "work item activity cursor is invalid",
      );
    }
    return await this.store.listActivities(projectId, workItemId, {
      ...(options.cursor ? { cursor: options.cursor } : {}),
      limit: Math.min(100, Math.max(1, options.limit ?? 50)),
    });
  };

  listStates = async (projectId: string): Promise<ProjectWorkState[]> => {
    await this.ensureProject(projectId);
    return await this.store.listStates(projectId);
  };

  createState = async (
    projectId: string,
    input: CreateProjectWorkStateInput,
  ): Promise<ProjectWorkState> => {
    await this.ensureProject(projectId);
    const normalized = {
      ...input,
      name: this.requireName(input.name, "state name"),
    };
    this.assertCategory(normalized.category);
    if (
      (await this.store.listStates(projectId)).some(
        (state) =>
          state.name.toLocaleLowerCase() ===
          normalized.name.toLocaleLowerCase(),
      )
    ) {
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_INVALID",
        "state name is already in use",
      );
    }
    const state = await this.store.createState(projectId, normalized);
    await this.emit(projectId, "state-config");
    return state;
  };

  updateState = async (
    projectId: string,
    stateId: string,
    input: UpdateProjectWorkStateInput,
  ): Promise<ProjectWorkState> => {
    await this.ensureProject(projectId);
    const normalizedInput = {
      ...input,
      ...(input.name !== undefined
        ? { name: this.requireName(input.name, "state name") }
        : {}),
    };
    if (normalizedInput.category !== undefined)
      this.assertCategory(normalizedInput.category);
    const current = await this.store.getState(projectId, stateId);
    if (!current)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    if (current.isDefault && normalizedInput.isDefault === false) {
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_INVALID",
        "choose another default state before clearing this one",
      );
    }
    if (
      normalizedInput.name &&
      (await this.store.listStates(projectId)).some(
        (state) =>
          state.id !== stateId &&
          state.name.toLocaleLowerCase() ===
            normalizedInput.name!.toLocaleLowerCase(),
      )
    ) {
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_INVALID",
        "state name is already in use",
      );
    }
    const state = await this.store.updateState(
      projectId,
      stateId,
      normalizedInput,
    );
    if (!state)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    await this.emit(projectId, "state-config");
    return state;
  };

  deleteState = async (
    projectId: string,
    stateId: string,
    migrateToStateId: string | null,
    actor: ProjectWorkActor,
  ): Promise<void> => {
    await this.ensureProject(projectId);
    const states = await this.store.listStates(projectId);
    if (states.length <= 1)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_INVALID",
        "a project must keep at least one state",
      );
    if (migrateToStateId === stateId)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_INVALID",
        "migration target must be a different state",
      );
    if (
      migrateToStateId &&
      !states.some((state) => state.id === migrateToStateId)
    ) {
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "migration target state was not found",
      );
    }
    try {
      const deleted = await this.store.deleteState(
        projectId,
        stateId,
        migrateToStateId,
        this.normalizeActor(actor),
      );
      if (!deleted)
        throw new ProjectWorkError(
          "PROJECT_WORK_STATE_NOT_FOUND",
          "work item state was not found",
        );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "PROJECT_WORK_STATE_IN_USE"
      ) {
        throw new ProjectWorkError(
          "PROJECT_WORK_STATE_IN_USE",
          "state is used by work items; choose a migration target",
        );
      }
      throw error;
    }
    await this.emit(projectId, "state-config");
  };

  linkArtifact = async (params: {
    projectId: string;
    workItemId: string;
    path: string;
    label?: string;
    actor: ProjectWorkActor;
  }): Promise<ProjectWorkArtifactLink> => {
    const { actor, label, path, projectId, workItemId } = params;
    const project = await this.requireProject(projectId);
    await this.get(projectId, workItemId);
    const artifactPath = await this.normalizeArtifactPath(
      project.rootPath,
      path,
    );
    const existing = (
      await this.store.listArtifacts(projectId, workItemId)
    ).find((link) => link.path === artifactPath);
    if (existing) return existing;
    const link = await this.store.linkArtifact({
      projectId,
      workItemId,
      path: artifactPath,
      label: label?.trim() || undefined,
      actor: this.normalizeActor(actor),
    });
    await this.emit(projectId, "artifact", workItemId);
    return link;
  };

  unlinkArtifact = async (params: {
    projectId: string;
    workItemId: string;
    artifactLinkId: string;
    actor: ProjectWorkActor;
  }): Promise<void> => {
    const { actor, artifactLinkId, projectId, workItemId } = params;
    await this.get(projectId, workItemId);
    const removed = await this.store.unlinkArtifact({
      projectId,
      workItemId,
      artifactLinkId,
      actor: this.normalizeActor(actor),
    });
    if (!removed)
      throw new ProjectWorkError(
        "PROJECT_WORK_ARTIFACT_NOT_FOUND",
        "artifact link was not found",
      );
    await this.emit(projectId, "artifact", workItemId);
  };

  private setDeleted = async (
    projectId: string,
    workItemId: string,
    deleted: boolean,
    actor: ProjectWorkActor,
  ): Promise<ProjectWorkItemDetail> => {
    await this.ensureProject(projectId);
    const current = await this.get(projectId, workItemId);
    if ((current.deletedAt !== null) === deleted) return current;
    const item = await this.store.setDeleted({
      projectId,
      workItemId,
      deleted,
      actor: this.normalizeActor(actor),
    });
    if (!item)
      throw new ProjectWorkError(
        "PROJECT_WORK_ITEM_NOT_FOUND",
        "work item was not found",
      );
    await this.emit(projectId, deleted ? "deleted" : "restored", workItemId);
    return await this.get(projectId, workItemId);
  };

  private requireProject = async (projectId: string) => {
    const normalized = projectId.trim();
    const project = normalized
      ? await this.options.projectManager.getProjectById(normalized)
      : null;
    if (!project)
      throw new ProjectWorkError("PROJECT_NOT_FOUND", "project was not found");
    return project;
  };

  private requireName = (value: unknown, label: string): string => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized)
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        `${label} is required`,
      );
    if (normalized.length > 200)
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        `${label} is too long`,
      );
    return normalized;
  };

  private assertAttention = (value: string): void => {
    if (!PROJECT_WORK_ATTENTION_VALUES.some((entry) => entry === value)) {
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        "work item attention is invalid",
      );
    }
  };

  private assertCategory = (value: string): void => {
    if (!PROJECT_WORK_STATE_CATEGORIES.some((entry) => entry === value)) {
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        "work item state category is invalid",
      );
    }
  };

  private normalizeActor = (actor: ProjectWorkActor): ProjectWorkActor => ({
    kind: actor.kind,
    ...(actor.id?.trim() ? { id: actor.id.trim() } : {}),
    ...(actor.sessionId?.trim() ? { sessionId: actor.sessionId.trim() } : {}),
  });

  private normalizeArtifactPath = async (
    rootPath: string,
    inputPath: string,
  ): Promise<string> => {
    const requested = inputPath.trim();
    if (!requested)
      throw new ProjectWorkError(
        "PROJECT_WORK_ARTIFACT_INVALID",
        "artifact path is required",
      );
    const canonicalRoot = await realpath(rootPath);
    const candidate = await realpath(
      isAbsolute(requested) ? requested : resolve(canonicalRoot, requested),
    ).catch(() => null);
    if (!candidate)
      throw new ProjectWorkError(
        "PROJECT_WORK_ARTIFACT_NOT_FOUND",
        "artifact file does not exist",
      );
    const relativePath = relative(canonicalRoot, candidate);
    if (
      !relativePath ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new ProjectWorkError(
        "PROJECT_WORK_ARTIFACT_INVALID",
        "artifact must be a file inside the project root",
      );
    }
    if (!(await stat(candidate)).isFile()) {
      throw new ProjectWorkError(
        "PROJECT_WORK_ARTIFACT_INVALID",
        "artifact must be a file",
      );
    }
    return relativePath.split(sep).join("/");
  };

  private emit = async (
    projectId: string,
    change: ProjectWorkChangedEventPayload["change"],
    workItemId?: string,
  ): Promise<void> => {
    await this.options.eventBus.emit(eventKeys.projectWorkChanged, {
      projectId,
      change,
      ...(workItemId ? { workItemId } : {}),
    });
  };
}
