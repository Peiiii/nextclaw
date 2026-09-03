import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  openSqliteDatabase,
  runSqliteTransaction,
  type SqliteDatabase,
} from "@kernel/stores/sqlite-database.store.js";
import type {
  CreateProjectWorkItemInput,
  CreateProjectWorkStateInput,
  ProjectWorkActivityPage,
  ProjectWorkActor,
  ProjectWorkArtifactLink,
  ProjectWorkItem,
  ProjectWorkState,
  UpdateProjectWorkItemInput,
  UpdateProjectWorkStateInput,
} from "@kernel/features/projects/types/project-work.types.js";
import { ProjectWorkActivityStore } from "@kernel/features/projects/stores/project-work-activity.store.js";
import { ProjectWorkQueryStore } from "@kernel/features/projects/stores/project-work-query.store.js";
import { ProjectWorkStateStore } from "@kernel/features/projects/stores/project-work-state.store.js";

type WorkItemRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  state_id: string;
  attention: ProjectWorkItem["attention"];
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export class ProjectWorkStore {
  private database: SqliteDatabase | null = null;
  private readyPromise: Promise<void> | null = null;
  private readonly activities = new ProjectWorkActivityStore(() => this.db());
  readonly queries = new ProjectWorkQueryStore(() => this.db(), toItem);
  private readonly states = new ProjectWorkStateStore(
    () => this.db(),
    this.activities.insertActivity,
  );

  constructor(private readonly databasePath: string) {}

  initialize = async (): Promise<void> => await this.ensureReady();

  close = (): void => {
    this.database?.close();
    this.database = null;
    this.readyPromise = null;
  };

  ensureProject = async (projectId: string): Promise<void> => {
    await this.ensureReady();
    await this.states.ensureProject(projectId);
  };

  listStates = async (projectId: string): Promise<ProjectWorkState[]> => {
    await this.ensureReady();
    return await this.states.listStates(projectId);
  };

  getState = async (
    projectId: string,
    stateId: string,
  ): Promise<ProjectWorkState | null> => {
    await this.ensureReady();
    return await this.states.getState(projectId, stateId);
  };

  createState = async (
    projectId: string,
    input: CreateProjectWorkStateInput,
  ): Promise<ProjectWorkState> => {
    await this.ensureReady();
    return await this.states.createState(projectId, input);
  };

  updateState = async (
    projectId: string,
    stateId: string,
    input: UpdateProjectWorkStateInput,
  ): Promise<ProjectWorkState | null> => {
    await this.ensureReady();
    return await this.states.updateState(projectId, stateId, input);
  };

  deleteState = async (
    projectId: string,
    stateId: string,
    migrateToStateId: string | null,
    actor: ProjectWorkActor,
  ): Promise<boolean> => {
    await this.ensureReady();
    return await this.states.deleteState(
      projectId,
      stateId,
      migrateToStateId,
      actor,
    );
  };

  getItem = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkItem | null> => {
    await this.ensureReady();
    const row = this.db()
      .prepare(
        "SELECT * FROM project_work_items WHERE project_id = ? AND id = ? LIMIT 1",
      )
      .get(projectId, workItemId) as WorkItemRow | undefined;
    return row ? toItem(row) : null;
  };

  createItem = async (params: {
    projectId: string;
    input: CreateProjectWorkItemInput;
    stateId: string;
    actor: ProjectWorkActor;
  }): Promise<ProjectWorkItem> => {
    await this.ensureReady();
    const now = new Date().toISOString();
    const id = randomUUID();
    runSqliteTransaction(
      this.db(),
      () => {
        this.db()
          .prepare(
            `INSERT INTO project_work_items
         (id, project_id, title, description, state_id, attention, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
          )
          .run(
            id,
            params.projectId,
            params.input.title,
            params.input.description ?? "",
            params.stateId,
            params.input.attention ?? "none",
            now,
            now,
          );
        this.activities.insertActivity({
          projectId: params.projectId,
          workItemId: id,
          type: "created",
          actor: params.actor,
          details: { stateId: params.stateId },
          createdAt: now,
        });
      },
      "IMMEDIATE",
    );
    return (await this.getItem(params.projectId, id)) as ProjectWorkItem;
  };

  updateItem = async (params: {
    projectId: string;
    workItemId: string;
    input: UpdateProjectWorkItemInput;
    actor: ProjectWorkActor;
  }): Promise<ProjectWorkItem | null> => {
    await this.ensureReady();
    const { actor, input, projectId, workItemId } = params;
    const current = await this.getItem(projectId, workItemId);
    if (!current) return null;
    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== current.version
    ) {
      throw new Error("PROJECT_WORK_VERSION_CONFLICT");
    }
    const now = new Date().toISOString();
    const next = { ...current, ...input };
    runSqliteTransaction(
      this.db(),
      () => {
        this.db()
          .prepare(
            `UPDATE project_work_items SET title = ?, description = ?, state_id = ?, attention = ?,
         version = version + 1, updated_at = ? WHERE project_id = ? AND id = ?`,
          )
          .run(
            next.title,
            next.description,
            next.stateId,
            next.attention,
            now,
            projectId,
            workItemId,
          );
        const stateChanged = next.stateId !== current.stateId;
        this.activities.insertActivity({
          projectId,
          workItemId,
          type: stateChanged ? "state-changed" : "updated",
          actor,
          details: stateChanged
            ? { fromStateId: current.stateId, toStateId: next.stateId }
            : changedItemFields(current, next),
          createdAt: now,
        });
      },
      "IMMEDIATE",
    );
    return await this.getItem(projectId, workItemId);
  };

  setDeleted = async (params: {
    projectId: string;
    workItemId: string;
    deleted: boolean;
    actor: ProjectWorkActor;
  }): Promise<ProjectWorkItem | null> => {
    await this.ensureReady();
    const { actor, deleted, projectId, workItemId } = params;
    const current = await this.getItem(projectId, workItemId);
    if (!current) return null;
    const now = new Date().toISOString();
    runSqliteTransaction(
      this.db(),
      () => {
        this.db()
          .prepare(
            `UPDATE project_work_items SET deleted_at = ?, version = version + 1, updated_at = ?
         WHERE project_id = ? AND id = ?`,
          )
          .run(deleted ? now : null, now, projectId, workItemId);
        this.activities.insertActivity({
          projectId,
          workItemId,
          type: deleted ? "deleted" : "restored",
          actor,
          details: {},
          createdAt: now,
        });
      },
      "IMMEDIATE",
    );
    return await this.getItem(projectId, workItemId);
  };

  listActivities = async (
    projectId: string,
    workItemId: string,
    options: { cursor?: string; limit: number },
  ): Promise<ProjectWorkActivityPage> => {
    await this.ensureReady();
    return await this.activities.listActivities(projectId, workItemId, options);
  };

  listArtifacts = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkArtifactLink[]> => {
    await this.ensureReady();
    return await this.activities.listArtifacts(projectId, workItemId);
  };

  linkArtifact = async (params: {
    projectId: string;
    workItemId: string;
    path: string;
    label?: string;
    actor: ProjectWorkActor;
  }): Promise<ProjectWorkArtifactLink> => {
    await this.ensureReady();
    return await this.activities.linkArtifact(params);
  };

  unlinkArtifact = async (params: {
    projectId: string;
    workItemId: string;
    artifactLinkId: string;
    actor: ProjectWorkActor;
  }): Promise<boolean> => {
    await this.ensureReady();
    return await this.activities.unlinkArtifact(params);
  };

  private ensureReady = async (): Promise<void> => {
    this.readyPromise ??= this.open();
    await this.readyPromise;
  };

  private open = async (): Promise<void> => {
    await mkdir(dirname(this.databasePath), { recursive: true });
    this.database = await openSqliteDatabase(this.databasePath);
    this.database.exec(`
      PRAGMA busy_timeout = 10000;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS project_work_states (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        position INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, name)
      );
      CREATE TABLE IF NOT EXISTS project_work_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        state_id TEXT NOT NULL,
        attention TEXT NOT NULL DEFAULT 'none',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY(state_id) REFERENCES project_work_states(id)
      );
      CREATE TABLE IF NOT EXISTS project_work_activities (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        work_item_id TEXT NOT NULL,
        type TEXT NOT NULL,
        actor_json TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(work_item_id) REFERENCES project_work_items(id)
      );
      CREATE TABLE IF NOT EXISTS project_work_artifact_links (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        work_item_id TEXT NOT NULL,
        path TEXT NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, work_item_id, path),
        FOREIGN KEY(work_item_id) REFERENCES project_work_items(id)
      );
      CREATE INDEX IF NOT EXISTS project_work_items_list_idx
      ON project_work_items(project_id, deleted_at, updated_at);
      CREATE INDEX IF NOT EXISTS project_work_items_state_list_idx
      ON project_work_items(project_id, state_id, deleted_at, updated_at, id);
      CREATE INDEX IF NOT EXISTS project_work_activity_timeline_idx
      ON project_work_activities(project_id, work_item_id, created_at);
      CREATE INDEX IF NOT EXISTS project_work_artifacts_recent_idx
      ON project_work_artifact_links(project_id, created_at, id);
    `);
  };

  private db = (): SqliteDatabase => {
    if (!this.database)
      throw new Error("Project work database is not initialized.");
    return this.database;
  };
}

function toItem(row: WorkItemRow): ProjectWorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    stateId: row.state_id,
    attention: row.attention,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function changedItemFields(
  current: ProjectWorkItem,
  next: Pick<ProjectWorkItem, "attention" | "description" | "title">,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (current.title !== next.title)
    fields.title = { from: current.title, to: next.title };
  if (current.description !== next.description)
    fields.descriptionChanged = true;
  if (current.attention !== next.attention)
    fields.attention = { from: current.attention, to: next.attention };
  return fields;
}
