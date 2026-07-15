import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProjectRecord } from "@kernel/types/project.types.js";

const PROJECT_STORE_VERSION = 1;

type ProjectStoreFile = {
  version: typeof PROJECT_STORE_VERSION;
  projects: ProjectRecord[];
};

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
    const value = JSON.parse(source) as unknown;
    if (
      !this.isRecord(value) ||
      value.version !== PROJECT_STORE_VERSION ||
      !Array.isArray(value.projects) ||
      !value.projects.every(this.isProjectRecord)
    ) {
      throw new ProjectStoreError("project registry has an unsupported structure");
    }
    return {
      version: PROJECT_STORE_VERSION,
      projects: value.projects.map((project) => structuredClone(project)),
    };
  };

  private isProjectRecord = (value: unknown): value is ProjectRecord => {
    if (!this.isRecord(value)) {
      return false;
    }
    return (
      typeof value.name === "string" &&
      typeof value.rootPath === "string" &&
      (value.template === undefined || value.template === "empty" || value.template === "knowledge-base") &&
      typeof value.createdAt === "string" &&
      typeof value.updatedAt === "string"
    );
  };

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
