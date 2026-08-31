import { randomUUID } from "node:crypto";
import {
  runSqliteTransaction,
  type SqliteDatabase,
} from "@kernel/stores/sqlite-database.store.js";
import type {
  ProjectWorkActivity,
  ProjectWorkActivityPage,
  ProjectWorkActor,
  ProjectWorkArtifactLink,
} from "@kernel/features/projects/types/project-work.types.js";

type WorkActivityRow = {
  sequence: number;
  id: string;
  project_id: string;
  work_item_id: string;
  type: ProjectWorkActivity["type"];
  actor_json: string;
  details_json: string;
  created_at: string;
};

type ArtifactLinkRow = {
  id: string;
  project_id: string;
  work_item_id: string;
  path: string;
  label: string | null;
  created_at: string;
};

export class ProjectWorkActivityStore {
  constructor(private readonly db: () => SqliteDatabase) {}

  listActivities = async (
    projectId: string,
    workItemId: string,
    options: { cursor?: string; limit: number },
  ): Promise<ProjectWorkActivityPage> => {
    const { cursor, limit } = options;
    const cursorSequence = cursor ? Number(cursor) : null;
    if (cursorSequence !== null && !Number.isInteger(cursorSequence)) {
      throw new Error("PROJECT_WORK_ACTIVITY_CURSOR_INVALID");
    }
    const rows = this.db()
      .prepare(
        `SELECT rowid AS sequence, * FROM project_work_activities
         WHERE project_id = ? AND work_item_id = ? ${cursorSequence !== null ? "AND rowid < ?" : ""}
         ORDER BY rowid DESC LIMIT ?`,
      )
      .all(
        projectId,
        workItemId,
        ...(cursorSequence !== null ? [cursorSequence] : []),
        limit + 1,
      ) as WorkActivityRow[];
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    return {
      activities: pageRows.map(toActivity),
      nextCursor: hasMore ? String(pageRows.at(-1)?.sequence) : null,
    };
  };

  listArtifacts = async (
    projectId: string,
    workItemId: string,
  ): Promise<ProjectWorkArtifactLink[]> =>
    (
      this.db()
        .prepare(
          `SELECT * FROM project_work_artifact_links
           WHERE project_id = ? AND work_item_id = ? ORDER BY created_at DESC`,
        )
        .all(projectId, workItemId) as ArtifactLinkRow[]
    ).map(toArtifactLink);

  linkArtifact = async (params: {
    projectId: string;
    workItemId: string;
    path: string;
    label?: string;
    actor: ProjectWorkActor;
  }): Promise<ProjectWorkArtifactLink> => {
    const { actor, label, path, projectId, workItemId } = params;
    const now = new Date().toISOString();
    const id = randomUUID();
    runSqliteTransaction(
      this.db(),
      () => {
        this.db()
          .prepare(
            `INSERT INTO project_work_artifact_links
             (id, project_id, work_item_id, path, label, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(id, projectId, workItemId, path, label ?? null, now);
        this.insertActivity({
          projectId,
          workItemId,
          type: "artifact-linked",
          actor,
          details: { artifactLinkId: id, path },
          createdAt: now,
        });
      },
      "IMMEDIATE",
    );
    return (await this.listArtifacts(projectId, workItemId)).find(
      (link) => link.id === id,
    ) as ProjectWorkArtifactLink;
  };

  unlinkArtifact = async (params: {
    projectId: string;
    workItemId: string;
    artifactLinkId: string;
    actor: ProjectWorkActor;
  }): Promise<boolean> => {
    const { actor, artifactLinkId, projectId, workItemId } = params;
    const link = this.db()
      .prepare(
        `SELECT * FROM project_work_artifact_links
         WHERE project_id = ? AND work_item_id = ? AND id = ? LIMIT 1`,
      )
      .get(projectId, workItemId, artifactLinkId) as
      | ArtifactLinkRow
      | undefined;
    if (!link) return false;
    const now = new Date().toISOString();
    runSqliteTransaction(
      this.db(),
      () => {
        this.db()
          .prepare(
            "DELETE FROM project_work_artifact_links WHERE project_id = ? AND work_item_id = ? AND id = ?",
          )
          .run(projectId, workItemId, artifactLinkId);
        this.insertActivity({
          projectId,
          workItemId,
          type: "artifact-unlinked",
          actor,
          details: { artifactLinkId: link.id, path: link.path },
          createdAt: now,
        });
      },
      "IMMEDIATE",
    );
    return true;
  };

  insertActivity = (activity: Omit<ProjectWorkActivity, "id">): void => {
    this.db()
      .prepare(
        `INSERT INTO project_work_activities
         (id, project_id, work_item_id, type, actor_json, details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        activity.projectId,
        activity.workItemId,
        activity.type,
        JSON.stringify(activity.actor),
        JSON.stringify(activity.details),
        activity.createdAt,
      );
  };
}

function toActivity(row: WorkActivityRow): ProjectWorkActivity {
  return {
    id: row.id,
    projectId: row.project_id,
    workItemId: row.work_item_id,
    type: row.type,
    actor: JSON.parse(row.actor_json) as ProjectWorkActor,
    details: JSON.parse(row.details_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function toArtifactLink(row: ArtifactLinkRow): ProjectWorkArtifactLink {
  return {
    id: row.id,
    projectId: row.project_id,
    workItemId: row.work_item_id,
    path: row.path,
    label: row.label,
    createdAt: row.created_at,
  };
}
