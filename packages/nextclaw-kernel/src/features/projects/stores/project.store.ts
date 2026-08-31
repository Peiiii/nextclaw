import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProjectRecord } from "@kernel/features/projects/types/project.types.js";

const PROJECT_STORE_VERSION = 2;

type ProjectStoreFile = {
  version: typeof PROJECT_STORE_VERSION;
  projects: ProjectRecord[];
};

type LegacyProjectRecord = Omit<ProjectRecord, "id">;

type LegacyProjectStoreFile = {
  version: 1;
  projects: LegacyProjectRecord[];
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
  constructor(private readonly storePath: string) {}

  list = async (): Promise<ProjectRecord[]> => {
    try {
      return this.parseStoreFile(await readFile(this.storePath, "utf8")).projects;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      if (error instanceof SyntaxError) {
        throw new ProjectStoreError("project registry contains invalid JSON");
      }
      throw error;
    }
  };

  migrateLegacyRecords = async (): Promise<boolean> => {
    let source: string;
    try {
      source = await readFile(this.storePath, "utf8");
    } catch (error) {
      if (this.isMissingFileError(error)) return false;
      throw error;
    }
    let storeFile: ProjectStoreFile | LegacyProjectStoreFile;
    try {
      storeFile = this.parseStoredFile(source);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ProjectStoreError("project registry contains invalid JSON");
      }
      throw error;
    }
    if (storeFile.version === PROJECT_STORE_VERSION) return false;
    await this.save(storeFile.projects.map((project) => ({ id: createProjectId(), ...project })));
    return true;
  };

  save = async (projects: ProjectRecord[]): Promise<void> => {
    const tempPath = `${this.storePath}.${randomUUID()}.tmp`;
    const storeFile: ProjectStoreFile = {
      version: PROJECT_STORE_VERSION,
      projects,
    };
    await mkdir(dirname(this.storePath), { recursive: true });
    try {
      await writeFile(tempPath, `${JSON.stringify(storeFile, null, 2)}\n`, "utf8");
      await rename(tempPath, this.storePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  private parseStoreFile = (source: string): ProjectStoreFile => {
    const value = this.parseStoredFile(source);
    if (
      value.version !== PROJECT_STORE_VERSION ||
      !value.projects.every(this.isProjectRecord)
    ) {
      throw new ProjectStoreError("project registry has an unsupported structure");
    }
    return {
      version: PROJECT_STORE_VERSION,
      projects: value.projects.map((project) => structuredClone(project)),
    };
  };

  private parseStoredFile = (source: string): ProjectStoreFile | LegacyProjectStoreFile => {
    const value = JSON.parse(source) as unknown;
    if (!this.isRecord(value) || !Array.isArray(value.projects)) {
      throw new ProjectStoreError("project registry has an unsupported structure");
    }
    if (value.version === PROJECT_STORE_VERSION && value.projects.every(this.isProjectRecord)) {
      return { version: PROJECT_STORE_VERSION, projects: value.projects.map((project) => structuredClone(project)) };
    }
    if (value.version === 1 && value.projects.every(this.isLegacyProjectRecord)) {
      return { version: 1, projects: value.projects.map((project) => structuredClone(project)) };
    }
    throw new ProjectStoreError("project registry has an unsupported structure");
  };

  private isProjectRecord = (value: unknown): value is ProjectRecord => {
    if (!this.isRecord(value)) {
      return false;
    }
    return (
      typeof value.id === "string" &&
      value.id.length > 0 &&
      typeof value.name === "string" &&
      typeof value.rootPath === "string" &&
      (value.template === undefined || value.template === "empty" || value.template === "knowledge-base") &&
      typeof value.createdAt === "string" &&
      typeof value.updatedAt === "string"
    );
  };

  private isLegacyProjectRecord = (value: unknown): value is LegacyProjectRecord => {
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
}
