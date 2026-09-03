import { stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { DEFAULT_PROJECT_SKILLS_DIR_NAME, SkillsLoader } from "@nextclaw/core";
import {
  ProjectError,
  type ProjectManager,
} from "@kernel/features/projects/managers/project.manager.js";
import type {
  ProjectAgreementMaterial,
  ProjectSkillMaterial,
} from "@kernel/features/projects/types/project-material.types.js";

const PROJECT_AGREEMENT_PATH = "AGENTS.md" as const;

export class ProjectMaterialService {
  constructor(
    private readonly options: {
      projectManager: Pick<ProjectManager, "getProjectById">;
    },
  ) {}

  getAgreement = async (
    projectId: string,
  ): Promise<ProjectAgreementMaterial> => {
    const project = await this.requireProject(projectId);
    return {
      path: PROJECT_AGREEMENT_PATH,
      available: await this.isFile(
        join(project.rootPath, PROJECT_AGREEMENT_PATH),
      ),
    };
  };

  listSkills = async (projectId: string): Promise<ProjectSkillMaterial[]> => {
    const project = await this.requireProject(projectId);
    const loader = new SkillsLoader({
      workspace: project.rootPath,
      projectRoot: project.rootPath,
      projectSkillsDirName: DEFAULT_PROJECT_SKILLS_DIR_NAME,
      includeBuiltin: false,
      includeWorkspace: false,
      includeGlobal: false,
    });
    return loader
      .listSkills(false)
      .filter((skill) => skill.scope === "project")
      .map((skill) => {
        const metadata = loader.getSkillMetadata(skill) ?? {};
        return {
          ref: skill.ref,
          name: skill.name,
          ...(metadata.description
            ? { description: metadata.description }
            : {}),
          path: relative(project.rootPath, skill.path).split(sep).join("/"),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  };

  private requireProject = async (projectId: string) => {
    const normalized = projectId.trim();
    const project = normalized
      ? await this.options.projectManager.getProjectById(normalized)
      : null;
    if (!project) {
      throw new ProjectError("PROJECT_NOT_FOUND", "project was not found");
    }
    return project;
  };

  private isFile = async (path: string): Promise<boolean> => {
    try {
      return (await stat(path)).isFile();
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      ) {
        return false;
      }
      throw error;
    }
  };
}
