import type { SqliteDatabase } from "@kernel/stores/sqlite-database.store.js";
import type {
  ProjectWorkItem,
  ProjectWorkSummary,
} from "@kernel/features/projects/types/project-work.types.js";

type WorkItemListRow = {
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
  artifact_count: number;
};

export type ProjectArtifactRow = {
  id: string;
  path: string;
  label: string | null;
  work_item_id: string;
  work_item_title: string;
  created_at: string;
};

export type ProjectWorkStoreCursor = {
  updatedAt: string;
  id: string;
};

export type ProjectArtifactStoreCursor = {
  createdAt: string;
  id: string;
};

export class ProjectWorkQueryStore {
  constructor(
    private readonly db: () => SqliteDatabase,
    private readonly toItem: (row: WorkItemListRow) => ProjectWorkItem,
  ) {}

  listItems = (params: {
    projectId: string;
    stateId?: string;
    includeDeleted: boolean;
    cursor?: ProjectWorkStoreCursor;
    limit: number;
  }): {
    items: Array<ProjectWorkItem & { artifactCount: number }>;
    hasMore: boolean;
    total: number;
  } => {
    const { cursor, includeDeleted, limit, projectId, stateId } = params;
    const conditions = ["items.project_id = ?"];
    const values: Array<string | number> = [projectId];
    if (!includeDeleted) conditions.push("items.deleted_at IS NULL");
    if (stateId) {
      conditions.push("items.state_id = ?");
      values.push(stateId);
    }
    const total = Number(
      (
        this.db()
          .prepare(
            `SELECT COUNT(*) AS count FROM project_work_items AS items
             WHERE ${conditions.join(" AND ")}`,
          )
          .get(...values) as { count: number }
      ).count,
    );
    if (cursor) {
      conditions.push(
        "(items.updated_at < ? OR (items.updated_at = ? AND items.id < ?))",
      );
      values.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
    const rows = this.db()
      .prepare(
        `SELECT items.*,
          (SELECT COUNT(*) FROM project_work_artifact_links AS links
           WHERE links.project_id = items.project_id AND links.work_item_id = items.id) AS artifact_count
         FROM project_work_items AS items
         WHERE ${conditions.join(" AND ")}
         ORDER BY items.updated_at DESC, items.id DESC
         LIMIT ?`,
      )
      .all(...values, limit + 1) as WorkItemListRow[];
    return {
      items: rows.slice(0, limit).map((row) => ({
        ...this.toItem(row),
        artifactCount: Number(row.artifact_count),
      })),
      hasMore: rows.length > limit,
      total,
    };
  };

  summarizeItems = (projectId: string): ProjectWorkSummary => {
    const row = this.db()
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN states.category NOT IN ('completed', 'canceled') THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN states.category = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN items.attention != 'none' THEN 1 ELSE 0 END) AS attention,
          MAX(items.updated_at) AS updated_at
         FROM project_work_items AS items
         JOIN project_work_states AS states
           ON states.project_id = items.project_id AND states.id = items.state_id
         WHERE items.project_id = ? AND items.deleted_at IS NULL`,
      )
      .get(projectId) as {
      total: number;
      active: number | null;
      completed: number | null;
      attention: number | null;
      updated_at: string | null;
    };
    return {
      total: Number(row.total),
      active: Number(row.active ?? 0),
      completed: Number(row.completed ?? 0),
      attention: Number(row.attention ?? 0),
      updatedAt: row.updated_at,
    };
  };

  listArtifacts = (params: {
    projectId: string;
    cursor?: ProjectArtifactStoreCursor;
    limit: number;
    query?: string;
  }): {
    artifacts: ProjectArtifactRow[];
    hasMore: boolean;
    total: number;
  } => {
    const { cursor, limit, projectId, query } = params;
    const queryCondition = query ? "AND instr(lower(path), lower(?)) > 0" : "";
    const queryValues = query ? [query] : [];
    const total = Number(
      (
        this.db()
          .prepare(
            `SELECT COUNT(DISTINCT path) AS count
             FROM project_work_artifact_links
             WHERE project_id = ? ${queryCondition}`,
          )
          .get(projectId, ...queryValues) as { count: number }
      ).count,
    );
    const cursorCondition = cursor
      ? "AND (created_at < ? OR (created_at = ? AND id < ?))"
      : "";
    const rows = this.db()
      .prepare(
        `WITH ranked AS (
          SELECT links.id, links.path, links.label, links.work_item_id,
            items.title AS work_item_title, links.created_at,
            ROW_NUMBER() OVER (
              PARTITION BY links.path
              ORDER BY links.created_at DESC, links.id DESC
            ) AS path_rank
          FROM project_work_artifact_links AS links
          JOIN project_work_items AS items
            ON items.project_id = links.project_id AND items.id = links.work_item_id
          WHERE links.project_id = ?
        )
        SELECT id, path, label, work_item_id, work_item_title, created_at
        FROM ranked
        WHERE path_rank = 1 ${queryCondition} ${cursorCondition}
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      )
      .all(
        projectId,
        ...queryValues,
        ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
        limit + 1,
      ) as ProjectArtifactRow[];
    return {
      artifacts: rows.slice(0, limit),
      hasMore: rows.length > limit,
      total,
    };
  };
}
