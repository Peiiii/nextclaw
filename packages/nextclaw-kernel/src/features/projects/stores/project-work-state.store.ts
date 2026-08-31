import { randomUUID } from "node:crypto";
import {
  runSqliteTransaction,
  type SqliteDatabase,
} from "@kernel/stores/sqlite-database.store.js";
import type {
  CreateProjectWorkStateInput,
  ProjectWorkActivity,
  ProjectWorkActor,
  ProjectWorkState,
  UpdateProjectWorkStateInput,
} from "@kernel/features/projects/types/project-work.types.js";

type WorkStateRow = {
  id: string;
  project_id: string;
  name: string;
  category: ProjectWorkState["category"];
  position: number;
  is_default: number;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_PROJECT_WORK_STATES: ReadonlyArray<
  Pick<ProjectWorkState, "category" | "isDefault" | "name" | "position">
> = [
  { name: "Backlog", category: "backlog", position: 0, isDefault: false },
  { name: "Planned", category: "unstarted", position: 1, isDefault: true },
  { name: "In Progress", category: "started", position: 2, isDefault: false },
  { name: "In Review", category: "started", position: 3, isDefault: false },
  {
    name: "Awaiting Acceptance",
    category: "started",
    position: 4,
    isDefault: false,
  },
  { name: "Completed", category: "completed", position: 5, isDefault: false },
  { name: "Canceled", category: "canceled", position: 6, isDefault: false },
];

export class ProjectWorkStateStore {
  constructor(
    private readonly db: () => SqliteDatabase,
    private readonly insertActivity: (
      activity: Omit<ProjectWorkActivity, "id">,
    ) => void,
  ) {}

  ensureProject = async (projectId: string): Promise<void> => {
    const count = this.db()
      .prepare(
        "SELECT COUNT(*) AS total FROM project_work_states WHERE project_id = ?",
      )
      .get(projectId) as { total: number };
    if (count.total > 0) return;
    const now = new Date().toISOString();
    runSqliteTransaction(
      this.db(),
      () => {
        const current = this.db()
          .prepare(
            "SELECT COUNT(*) AS total FROM project_work_states WHERE project_id = ?",
          )
          .get(projectId) as { total: number };
        if (current.total > 0) return;
        const insert = this.db().prepare(
          `INSERT INTO project_work_states
           (id, project_id, name, category, position, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const state of DEFAULT_PROJECT_WORK_STATES) {
          insert.run(
            randomUUID(),
            projectId,
            state.name,
            state.category,
            state.position,
            state.isDefault ? 1 : 0,
            now,
            now,
          );
        }
      },
      "IMMEDIATE",
    );
  };

  listStates = async (projectId: string): Promise<ProjectWorkState[]> =>
    (
      this.db()
        .prepare(
          "SELECT * FROM project_work_states WHERE project_id = ? ORDER BY position, created_at",
        )
        .all(projectId) as WorkStateRow[]
    ).map(toState);

  getState = async (
    projectId: string,
    stateId: string,
  ): Promise<ProjectWorkState | null> => {
    const row = this.db()
      .prepare(
        "SELECT * FROM project_work_states WHERE project_id = ? AND id = ? LIMIT 1",
      )
      .get(projectId, stateId) as WorkStateRow | undefined;
    return row ? toState(row) : null;
  };

  createState = async (
    projectId: string,
    input: CreateProjectWorkStateInput,
  ): Promise<ProjectWorkState> => {
    const now = new Date().toISOString();
    const id = randomUUID();
    const position = input.position ?? this.nextStatePosition(projectId);
    runSqliteTransaction(
      this.db(),
      () => {
        if (input.isDefault) this.clearDefaultState(projectId);
        this.db()
          .prepare(
            `INSERT INTO project_work_states
             (id, project_id, name, category, position, is_default, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            projectId,
            input.name,
            input.category,
            position,
            input.isDefault ? 1 : 0,
            now,
            now,
          );
      },
      "IMMEDIATE",
    );
    return (await this.getState(projectId, id)) as ProjectWorkState;
  };

  updateState = async (
    projectId: string,
    stateId: string,
    input: UpdateProjectWorkStateInput,
  ): Promise<ProjectWorkState | null> => {
    const current = await this.getState(projectId, stateId);
    if (!current) return null;
    const next = { ...current, ...input, updatedAt: new Date().toISOString() };
    runSqliteTransaction(
      this.db(),
      () => {
        if (next.isDefault) this.clearDefaultState(projectId);
        this.db()
          .prepare(
            `UPDATE project_work_states
             SET name = ?, category = ?, position = ?, is_default = ?, updated_at = ?
             WHERE project_id = ? AND id = ?`,
          )
          .run(
            next.name,
            next.category,
            next.position,
            next.isDefault ? 1 : 0,
            next.updatedAt,
            projectId,
            stateId,
          );
      },
      "IMMEDIATE",
    );
    return await this.getState(projectId, stateId);
  };

  deleteState = async (
    projectId: string,
    stateId: string,
    migrateToStateId: string | null,
    actor: ProjectWorkActor,
  ): Promise<boolean> => {
    const current = await this.getState(projectId, stateId);
    if (!current) return false;
    runSqliteTransaction(
      this.db(),
      () => {
        const referenced = this.db()
          .prepare(
            "SELECT COUNT(*) AS total FROM project_work_items WHERE project_id = ? AND state_id = ?",
          )
          .get(projectId, stateId) as { total: number };
        if (referenced.total > 0 && !migrateToStateId) {
          throw new Error("PROJECT_WORK_STATE_IN_USE");
        }
        if (migrateToStateId) {
          this.migrateItems(projectId, stateId, migrateToStateId, actor);
        }
        this.db()
          .prepare(
            "DELETE FROM project_work_states WHERE project_id = ? AND id = ?",
          )
          .run(projectId, stateId);
        if (current.isDefault)
          this.assignReplacementDefault(projectId, migrateToStateId);
      },
      "IMMEDIATE",
    );
    return true;
  };

  private migrateItems = (
    projectId: string,
    stateId: string,
    migrateToStateId: string,
    actor: ProjectWorkActor,
  ): void => {
    const affected = this.db()
      .prepare(
        "SELECT id FROM project_work_items WHERE project_id = ? AND state_id = ?",
      )
      .all(projectId, stateId) as Array<{ id: string }>;
    const now = new Date().toISOString();
    this.db()
      .prepare(
        `UPDATE project_work_items
         SET state_id = ?, version = version + 1, updated_at = ?
         WHERE project_id = ? AND state_id = ?`,
      )
      .run(migrateToStateId, now, projectId, stateId);
    for (const item of affected) {
      this.insertActivity({
        projectId,
        workItemId: item.id,
        type: "state-changed",
        actor,
        details: {
          fromStateId: stateId,
          toStateId: migrateToStateId,
          reason: "state-deleted",
        },
        createdAt: now,
      });
    }
  };

  private assignReplacementDefault = (
    projectId: string,
    migrateToStateId: string | null,
  ): void => {
    const replacement =
      migrateToStateId ??
      (
        this.db()
          .prepare(
            "SELECT id FROM project_work_states WHERE project_id = ? ORDER BY position LIMIT 1",
          )
          .get(projectId) as { id: string } | undefined
      )?.id;
    if (replacement) {
      this.db()
        .prepare(
          "UPDATE project_work_states SET is_default = 1 WHERE project_id = ? AND id = ?",
        )
        .run(projectId, replacement);
    }
  };

  private nextStatePosition = (projectId: string): number => {
    const row = this.db()
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM project_work_states WHERE project_id = ?",
      )
      .get(projectId) as { position: number };
    return row.position;
  };

  private clearDefaultState = (projectId: string): void => {
    this.db()
      .prepare(
        "UPDATE project_work_states SET is_default = 0 WHERE project_id = ?",
      )
      .run(projectId);
  };
}

function toState(row: WorkStateRow): ProjectWorkState {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    category: row.category,
    position: row.position,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
