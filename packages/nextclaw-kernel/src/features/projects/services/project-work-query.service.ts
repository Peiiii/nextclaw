import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ProjectManager } from "@kernel/features/projects/managers/project.manager.js";
import type { ProjectWorkStore } from "@kernel/features/projects/stores/project-work.store.js";
import type {
  ProjectArtifactStoreCursor,
  ProjectWorkStoreCursor,
} from "@kernel/features/projects/stores/project-work-query.store.js";
import { ProjectWorkError } from "@kernel/features/projects/types/project-work-error.types.js";
import type {
  ProjectRecentArtifactPage,
  ProjectWorkItemPage,
  ProjectWorkListInput,
  ProjectWorkState,
  ProjectWorkSummary,
} from "@kernel/features/projects/types/project-work.types.js";

export class ProjectWorkQueryService {
  constructor(
    private readonly store: ProjectWorkStore,
    private readonly projectManager: ProjectManager,
  ) {}

  list = async (
    projectId: string,
    input: ProjectWorkListInput = {},
  ): Promise<ProjectWorkItemPage> => {
    await this.ensureProject(projectId);
    const limit = this.requirePageLimit(input.limit);
    const cursor = input.cursor
      ? this.decodeCursor<ProjectWorkStoreCursor>(
          input.cursor,
          "work item",
          "updatedAt",
        )
      : undefined;
    const states = await this.store.listStates(projectId);
    if (input.stateId && !states.some((state) => state.id === input.stateId)) {
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    }
    const page = this.store.queries.listItems({
      projectId,
      includeDeleted: input.includeDeleted ?? false,
      limit,
      ...(input.stateId ? { stateId: input.stateId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const stateById = new Map(states.map((state) => [state.id, state]));
    const items = page.items.map((item) => ({
      ...item,
      state: this.requireMappedState(stateById, item.stateId),
    }));
    const last = items.at(-1);
    return {
      items,
      total: page.total,
      nextCursor:
        page.hasMore && last
          ? this.encodeCursor({ updatedAt: last.updatedAt, id: last.id })
          : null,
    };
  };

  summary = async (projectId: string): Promise<ProjectWorkSummary> => {
    await this.ensureProject(projectId);
    return this.store.queries.summarizeItems(projectId);
  };

  listArtifacts = async (
    projectId: string,
    input: { cursor?: string; limit?: number; query?: string } = {},
  ): Promise<ProjectRecentArtifactPage> => {
    const project = await this.requireProject(projectId);
    await this.store.ensureProject(projectId);
    const limit = this.requirePageLimit(input.limit);
    const cursor = input.cursor
      ? this.decodeCursor<ProjectArtifactStoreCursor>(
          input.cursor,
          "project artifact",
          "createdAt",
        )
      : undefined;
    const query = input.query?.trim();
    const page = this.store.queries.listArtifacts({
      projectId,
      limit,
      ...(query ? { query } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const artifacts = await Promise.all(
      page.artifacts.map(async (artifact) => ({
        id: artifact.id,
        path: artifact.path,
        label: artifact.label,
        workItemId: artifact.work_item_id,
        workItemTitle: artifact.work_item_title,
        createdAt: artifact.created_at,
        exists: await this.isArtifactAvailable(project.rootPath, artifact.path),
      })),
    );
    const last = artifacts.at(-1);
    return {
      artifacts,
      total: page.total,
      nextCursor:
        page.hasMore && last
          ? this.encodeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  };

  private ensureProject = async (projectId: string): Promise<void> => {
    await this.requireProject(projectId);
    await this.store.ensureProject(projectId);
  };

  private requireProject = async (projectId: string) => {
    const normalized = projectId.trim();
    const project = normalized
      ? await this.projectManager.getProjectById(normalized)
      : null;
    if (!project)
      throw new ProjectWorkError("PROJECT_NOT_FOUND", "project was not found");
    return project;
  };

  private requireMappedState = (
    states: Map<string, ProjectWorkState>,
    stateId: string,
  ): ProjectWorkState => {
    const state = states.get(stateId);
    if (!state)
      throw new ProjectWorkError(
        "PROJECT_WORK_STATE_NOT_FOUND",
        "work item state was not found",
      );
    return state;
  };

  private requirePageLimit = (value: number | undefined): number => {
    const limit = value ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        "page limit must be an integer between 1 and 100",
      );
    }
    return limit;
  };

  private encodeCursor = (value: Record<string, string>): string =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

  private decodeCursor = <T extends Record<string, string>>(
    value: string,
    label: string,
    timestampKey: "createdAt" | "updatedAt",
  ): T => {
    try {
      const decoded = JSON.parse(
        Buffer.from(value, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      if (
        !decoded ||
        typeof decoded !== "object" ||
        typeof decoded.id !== "string" ||
        typeof decoded[timestampKey] !== "string" ||
        Object.keys(decoded).some(
          (key) => key !== "id" && key !== timestampKey,
        ) ||
        Object.values(decoded).some(
          (entry) => typeof entry !== "string" || !entry,
        )
      ) {
        throw new Error("invalid cursor shape");
      }
      return decoded as T;
    } catch {
      throw new ProjectWorkError(
        "PROJECT_WORK_VALIDATION_FAILED",
        `${label} cursor is invalid`,
      );
    }
  };

  private isArtifactAvailable = async (
    projectRoot: string,
    projectRelativePath: string,
  ): Promise<boolean> => {
    try {
      const artifact = await stat(resolve(projectRoot, projectRelativePath));
      return artifact.isFile();
    } catch {
      return false;
    }
  };
}
