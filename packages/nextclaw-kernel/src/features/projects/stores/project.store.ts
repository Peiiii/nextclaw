import { randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  openSqliteDatabase,
  runSqliteTransaction,
  type SqliteDatabase,
} from "@kernel/stores/sqlite-database.store.js";
import type { ProjectRecord } from "@kernel/features/projects/types/project.types.js";

const PROJECT_STORE_VERSION = 3;
const LEGACY_PROJECTS_MIGRATION_ID = "projects-json-to-sqlite-v1";

type ProjectStoreFile = {
  version: typeof PROJECT_STORE_VERSION;
  projects: ProjectRecord[];
  removedProjects: ProjectRecord[];
};

type PreviousProjectStoreFile = {
  version: 2;
  projects: ProjectRecord[];
};

type LegacyProjectRecord = Omit<ProjectRecord, "id">;

type LegacyProjectStoreFile = {
  version: 1;
  projects: LegacyProjectRecord[];
};

type ProjectRow = {
  id: string;
  name: string;
  root_path: string;
  template: ProjectRecord["template"] | null;
  created_at: string;
  updated_at: string;
};

export function createProjectId(): string {
  return randomBytes(9).toString("base64url");
}

export class ProjectStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectStoreError";
  }
}

export class ProjectStore {
  private database: SqliteDatabase | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor(
    private readonly options: {
      databasePath: string;
      legacyStorePath: string;
    },
  ) {}

  initialize = async (): Promise<void> => await this.ensureReady();

  close = (): void => {
    this.database?.close();
    this.database = null;
    this.readyPromise = null;
  };

  list = async (): Promise<ProjectRecord[]> => {
    await this.ensureReady();
    return (this.db()
      .prepare("SELECT * FROM projects WHERE removed_at IS NULL")
      .all() as ProjectRow[]).map(toProjectRecord);
  };

  add = async (project: ProjectRecord): Promise<void> => {
    await this.ensureReady();
    this.insertProject(project, null);
  };

  remove = async (projectId: string): Promise<ProjectRecord | null> => {
    await this.ensureReady();
    const row = this.db()
      .prepare(
        "SELECT * FROM projects WHERE id = ? AND removed_at IS NULL LIMIT 1",
      )
      .get(projectId) as ProjectRow | undefined;
    if (!row) return null;
    this.db()
      .prepare("UPDATE projects SET removed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), projectId);
    return toProjectRecord(row);
  };

  restoreByRootPath = async (
    rootPath: string,
    updatedAt: string,
  ): Promise<ProjectRecord | null> => {
    await this.ensureReady();
    const row = this.db()
      .prepare(
        "SELECT * FROM projects WHERE root_path = ? AND removed_at IS NOT NULL LIMIT 1",
      )
      .get(rootPath) as ProjectRow | undefined;
    if (!row) return null;
    this.db()
      .prepare(
        "UPDATE projects SET removed_at = NULL, updated_at = ? WHERE id = ?",
      )
      .run(updatedAt, row.id);
    return { ...toProjectRecord(row), updatedAt };
  };

  isRemovedRootPath = async (rootPath: string): Promise<boolean> => {
    await this.ensureReady();
    return Boolean(
      this.db()
        .prepare(
          "SELECT id FROM projects WHERE root_path = ? AND removed_at IS NOT NULL LIMIT 1",
        )
        .get(rootPath),
    );
  };

  private ensureReady = async (): Promise<void> => {
    this.readyPromise ??= this.open();
    await this.readyPromise;
  };

  private open = async (): Promise<void> => {
    await mkdir(dirname(this.options.databasePath), { recursive: true });
    this.database = await openSqliteDatabase(this.options.databasePath);
    try {
      this.database.exec(`
        PRAGMA busy_timeout = 10000;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          root_path TEXT NOT NULL UNIQUE,
          template TEXT CHECK(template IS NULL OR template IN ('empty', 'knowledge-base')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          removed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS project_storage_migrations (
          id TEXT PRIMARY KEY,
          completed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS projects_active_updated_idx
        ON projects(removed_at, updated_at);
      `);
      await this.migrateLegacyRegistry();
    } catch (error) {
      this.database.close();
      this.database = null;
      throw error;
    }
  };

  private migrateLegacyRegistry = async (): Promise<void> => {
    const migrated = this.db()
      .prepare("SELECT id FROM project_storage_migrations WHERE id = ? LIMIT 1")
      .get(LEGACY_PROJECTS_MIGRATION_ID);
    if (migrated) return;

    const legacy = await this.readLegacyStoreFile();
    const completedAt = new Date().toISOString();
    runSqliteTransaction(
      this.db(),
      () => {
        if (legacy) {
          for (const project of legacy.projects) {
            this.insertProject(project, null);
          }
          for (const project of legacy.removedProjects) {
            this.insertProject(project, completedAt);
          }
        }
        this.db()
          .prepare(
            "INSERT INTO project_storage_migrations (id, completed_at) VALUES (?, ?)",
          )
          .run(LEGACY_PROJECTS_MIGRATION_ID, completedAt);
      },
      "IMMEDIATE",
    );
    if (legacy) {
      console.log(
        `[project-store] migrated ${legacy.projects.length + legacy.removedProjects.length} project records from legacy JSON to SQLite`,
      );
    }
  };

  private readLegacyStoreFile = async (): Promise<ProjectStoreFile | null> => {
    let source: string;
    try {
      source = await readFile(this.options.legacyStorePath, "utf8");
    } catch (error) {
      if (this.isMissingFileError(error)) return null;
      throw error;
    }
    let storeFile:
      | ProjectStoreFile
      | PreviousProjectStoreFile
      | LegacyProjectStoreFile;
    try {
      storeFile = this.parseStoredFile(source);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ProjectStoreError("project registry contains invalid JSON");
      }
      throw error;
    }
    if (storeFile.version === 1) {
      return {
        version: PROJECT_STORE_VERSION,
        projects: storeFile.projects.map((project) => ({
          id: createProjectId(),
          ...project,
        })),
        removedProjects: [],
      };
    }
    return {
      version: PROJECT_STORE_VERSION,
      projects: storeFile.projects,
      removedProjects:
        storeFile.version === PROJECT_STORE_VERSION
          ? storeFile.removedProjects
          : [],
    };
  };

  private insertProject = (
    project: ProjectRecord,
    removedAt: string | null,
  ): void => {
    this.db()
      .prepare(
        `INSERT INTO projects
         (id, name, root_path, template, created_at, updated_at, removed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.name,
        project.rootPath,
        project.template ?? null,
        project.createdAt,
        project.updatedAt,
        removedAt,
      );
  };

  private parseStoredFile = (
    source: string,
  ): ProjectStoreFile | PreviousProjectStoreFile | LegacyProjectStoreFile => {
    const value = JSON.parse(source) as unknown;
    if (!this.isRecord(value) || !Array.isArray(value.projects)) {
      throw new ProjectStoreError(
        "project registry has an unsupported structure",
      );
    }
    if (
      value.version === PROJECT_STORE_VERSION &&
      Array.isArray(value.removedProjects) &&
      value.projects.every(this.isProjectRecord) &&
      value.removedProjects.every(this.isProjectRecord)
    ) {
      return {
        version: PROJECT_STORE_VERSION,
        projects: value.projects.map((project) => structuredClone(project)),
        removedProjects: value.removedProjects.map((project) =>
          structuredClone(project),
        ),
      };
    }
    if (value.version === 2 && value.projects.every(this.isProjectRecord)) {
      return {
        version: 2,
        projects: value.projects.map((project) => structuredClone(project)),
      };
    }
    if (value.version === 1 && value.projects.every(this.isLegacyProjectRecord)) {
      return {
        version: 1,
        projects: value.projects.map((project) => structuredClone(project)),
      };
    }
    throw new ProjectStoreError("project registry has an unsupported structure");
  };

  private isProjectRecord = (value: unknown): value is ProjectRecord => {
    if (!this.isRecord(value)) return false;
    return (
      typeof value.id === "string" &&
      value.id.length > 0 &&
      typeof value.name === "string" &&
      typeof value.rootPath === "string" &&
      (value.template === undefined ||
        value.template === "empty" ||
        value.template === "knowledge-base") &&
      typeof value.createdAt === "string" &&
      typeof value.updatedAt === "string"
    );
  };

  private isLegacyProjectRecord = (
    value: unknown,
  ): value is LegacyProjectRecord => {
    if (!this.isRecord(value)) return false;
    const { id: _id, ...legacy } = value;
    return this.isProjectRecord({ id: "legacy", ...legacy });
  };

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";

  private db = (): SqliteDatabase => {
    if (!this.database) {
      throw new Error("Project database is not initialized.");
    }
    return this.database;
  };
}

function toProjectRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    rootPath: row.root_path,
    ...(row.template ? { template: row.template } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
