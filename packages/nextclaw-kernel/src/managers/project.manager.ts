import { mkdir, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { expandHome } from "@nextclaw/core";
import { ProjectStore } from "@kernel/stores/project.store.js";
import {
  PROJECT_TEMPLATE_IDS,
  type CreateProjectInput,
  type ProjectRecord,
  type ProjectTemplate,
  type ProjectTemplateId,
} from "@kernel/types/project.types.js";

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "empty",
    name: "Empty project",
    description: "Create an empty project directory.",
  },
  {
    id: "knowledge-base",
    name: "Knowledge base",
    description: "Create a knowledge base with sources and notes directories.",
  },
];

export type ProjectManagerOptions = {
  storePath: string;
  getDefaultWorkspacePath: () => string;
};

export type ProjectErrorCode =
  | "PROJECT_NAME_INVALID"
  | "PROJECT_PATH_INVALID_TYPE"
  | "PROJECT_PATH_NOT_FOUND"
  | "PROJECT_PATH_NOT_DIRECTORY"
  | "PROJECT_PATH_IS_DEFAULT_WORKSPACE"
  | "PROJECT_PATH_NOT_EMPTY"
  | "PROJECT_TEMPLATE_INVALID";

export class ProjectError extends Error {
  constructor(
    readonly code: ProjectErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

export function isProjectError(error: unknown): error is ProjectError {
  return error instanceof ProjectError;
}

export class ProjectManager {
  private readonly store: ProjectStore;

  constructor(private readonly options: ProjectManagerOptions) {
    this.store = new ProjectStore(options.storePath);
  }

  listProjects = async (): Promise<ProjectRecord[]> =>
    (await this.store.list()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name)
    );

  listTemplates = (): ProjectTemplate[] => structuredClone(PROJECT_TEMPLATES);

  createProject = async (input: CreateProjectInput): Promise<ProjectRecord> => {
    const name = this.normalizeName(input.name);
    const template = this.normalizeTemplate(input.template);
    const targetPath = input.rootPath === undefined
      ? join(this.resolveDefaultWorkspacePath(), name)
      : this.resolvePath(input.rootPath);
    await this.assertNotDefaultWorkspace(targetPath);
    const existing = await this.readPathState(targetPath);
    if (existing === "file") {
      throw new ProjectError("PROJECT_PATH_NOT_DIRECTORY", "project path must point to a directory");
    }
    if (existing === "non-empty-directory") {
      throw new ProjectError("PROJECT_PATH_NOT_EMPTY", "project path must be empty");
    }
    await mkdir(targetPath, { recursive: true });
    const rootPath = await realpath(targetPath);
    await this.materializeTemplate({ name, rootPath, template });
    return await this.upsertProject({ name, rootPath, template });
  };

  registerExistingProject = async (
    rootPath: unknown,
    name?: string,
  ): Promise<ProjectRecord | null> => {
    const canonicalPath = await this.resolveExistingProjectRoot(rootPath);
    if (!canonicalPath) {
      return null;
    }
    return await this.upsertProject({
      name: name === undefined ? basename(canonicalPath) : this.normalizeName(name),
      rootPath: canonicalPath,
    });
  };

  normalizeSessionProjectRoot = async (value: unknown): Promise<string | null> => {
    if (value == null || (typeof value === "string" && !value.trim())) {
      return null;
    }
    const rootPath = await this.resolveExistingProjectRoot(value);
    if (!rootPath) {
      return null;
    }
    await this.upsertProject({ name: basename(rootPath), rootPath });
    return rootPath;
  };

  resolveExistingProjectRoot = async (value: unknown): Promise<string | null> => {
    if (typeof value !== "string") {
      throw new ProjectError("PROJECT_PATH_INVALID_TYPE", "project path must be a string or null");
    }
    const candidate = this.resolvePath(value);
    let canonicalPath: string;
    try {
      canonicalPath = await realpath(candidate);
    } catch {
      throw new ProjectError("PROJECT_PATH_NOT_FOUND", "project directory does not exist");
    }
    if (!(await stat(canonicalPath)).isDirectory()) {
      throw new ProjectError("PROJECT_PATH_NOT_DIRECTORY", "project path must point to a directory");
    }
    return await this.isDefaultWorkspace(canonicalPath) ? null : canonicalPath;
  };

  importSessionProjects = async (projectRoots: unknown[]): Promise<void> => {
    for (const projectRoot of projectRoots) {
      if (projectRoot == null || (typeof projectRoot === "string" && !projectRoot.trim())) {
        continue;
      }
      try {
        await this.registerExistingProject(projectRoot);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[project-manager] skipped historical project root: ${message}`);
      }
    }
  };

  private upsertProject = async (input: {
    name: string;
    rootPath: string;
    template?: ProjectTemplateId;
  }): Promise<ProjectRecord> => {
    const projects = await this.store.list();
    const existing = projects.find((project) => project.rootPath === input.rootPath);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      name: input.name,
      rootPath: input.rootPath,
      ...(input.template ? { template: input.template } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.save([...projects, project]);
    return structuredClone(project);
  };

  private assertNotDefaultWorkspace = async (rootPath: string): Promise<void> => {
    if (await this.isDefaultWorkspace(rootPath)) {
      throw new ProjectError(
        "PROJECT_PATH_IS_DEFAULT_WORKSPACE",
        "the default workspace cannot be registered as a project",
      );
    }
  };

  private isDefaultWorkspace = async (rootPath: string): Promise<boolean> => {
    const defaultWorkspace = this.resolveDefaultWorkspacePath();
    let canonicalRootPath = rootPath;
    try {
      canonicalRootPath = await realpath(rootPath);
    } catch {
      canonicalRootPath = resolve(rootPath);
    }
    try {
      return canonicalRootPath === await realpath(defaultWorkspace);
    } catch {
      return canonicalRootPath === defaultWorkspace;
    }
  };

  private materializeTemplate = async (input: {
    name: string;
    rootPath: string;
    template: ProjectTemplateId;
  }): Promise<void> => {
    if (input.template === "empty") {
      return;
    }
    await mkdir(join(input.rootPath, "sources"), { recursive: true });
    await mkdir(join(input.rootPath, "notes"), { recursive: true });
    await writeFile(
      join(input.rootPath, "README.md"),
      `# ${input.name}\n\nThis knowledge base stores source materials in \`sources/\` and working notes in \`notes/\`.\n`,
      { encoding: "utf8", flag: "wx" },
    );
  };

  private readPathState = async (
    path: string,
  ): Promise<"missing" | "file" | "empty-directory" | "non-empty-directory"> => {
    try {
      const pathStat = await stat(path);
      if (!pathStat.isDirectory()) {
        return "file";
      }
      return (await readdir(path)).length === 0 ? "empty-directory" : "non-empty-directory";
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return "missing";
      }
      throw error;
    }
  };

  private normalizeName = (value: string): string => {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name || name.includes("/") || name.includes("\\") || name === "." || name === "..") {
      throw new ProjectError("PROJECT_NAME_INVALID", "project name is invalid");
    }
    return name;
  };

  private normalizeTemplate = (value: unknown): ProjectTemplateId => {
    const template = value ?? "empty";
    if (!PROJECT_TEMPLATE_IDS.some((templateId) => templateId === template)) {
      throw new ProjectError("PROJECT_TEMPLATE_INVALID", "project template is not supported");
    }
    return template as ProjectTemplateId;
  };

  private resolvePath = (value: unknown): string => {
    if (typeof value !== "string") {
      throw new ProjectError("PROJECT_PATH_INVALID_TYPE", "project path must be a string");
    }
    const path = value.trim();
    if (!path) {
      throw new ProjectError("PROJECT_PATH_INVALID_TYPE", "project path must not be empty");
    }
    return resolve(expandHome(path));
  };

  private resolveDefaultWorkspacePath = (): string =>
    resolve(expandHome(this.options.getDefaultWorkspacePath()));

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
