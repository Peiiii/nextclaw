import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SkillsLoader } from "@nextclaw/core";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { ProjectManager } from "@kernel/features/projects/managers/project.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import {
  ProjectObservationError,
  type ObservedArtifact,
  type ObservedProjectContextReference,
  type ObservedSkill,
  type ProjectObservationDiagnostic,
  type ProjectObservationSnapshot,
  type ProjectObservationSourceStatus,
} from "@kernel/features/projects/types/project-observation.types.js";
import {
  parseProjectObservationConfig,
  type ProjectObservationConfig,
} from "@kernel/features/projects/utils/project-observation-config.utils.js";
import {
  normalizeProjectRelativePath,
  observeProjectFile,
  scanProjectArtifactFiles,
} from "@kernel/features/projects/utils/project-observation-files.utils.js";
import {
  projectObservationConfigReference,
  projectObservationFileReference,
  projectObservedRuns,
} from "@kernel/features/projects/utils/project-observation-projection.utils.js";

type ProjectObservationServiceOptions = {
  projectManager: Pick<ProjectManager, "getRegisteredProject">;
  sessionManager: Pick<SessionManager, "listSessions">;
  workspacePath: string;
  now?: () => Date;
};

type DiagnosticSource = ProjectObservationDiagnostic["source"];

const SOURCE_LABELS: Record<DiagnosticSource, string> = {
  config: "项目配置",
  files: "项目文件",
  sessions: "项目会话",
  skills: "项目 Skills",
};

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
};

const readSessionProjectRoot = (session: NcpSessionSummary): string | undefined =>
  readOptionalString(session.metadata?.project_root) ?? readOptionalString(session.metadata?.projectRoot);

export class ProjectObservationService {
  private readonly now: () => Date;

  constructor(private readonly options: ProjectObservationServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  observe = async (rootPath: string): Promise<ProjectObservationSnapshot> => {
    let project;
    try {
      project = await this.options.projectManager.getRegisteredProject(rootPath);
    } catch (error) {
      throw new ProjectObservationError(
        "PROJECT_OBSERVATION_INVALID_ROOT",
        error instanceof Error ? error.message : "Project root is invalid.",
      );
    }
    if (!project) {
      throw new ProjectObservationError("PROJECT_NOT_REGISTERED", "Project is not registered.");
    }

    const asOf = this.now().toISOString();
    const diagnostics: ProjectObservationDiagnostic[] = [];
    const sourceCounts = new Map<DiagnosticSource, number>();
    const sourceErrors = new Set<DiagnosticSource>();
    const addDiagnostic = (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details: Pick<ProjectObservationDiagnostic, "projectRelativePath" | "sessionId" | "messageId"> = {},
    ): void => {
      if (level === "error") {
        sourceErrors.add(source);
      }
      diagnostics.push({
        id: `${source}:${code}:${diagnostics.filter((entry) => entry.source === source && entry.code === code).length + 1}`,
        source,
        level,
        code,
        message,
        ...details,
      });
    };
    const addSourceCount = (source: DiagnosticSource, count: number): void => {
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + count);
    };

    const config = await this.readConfig(project.rootPath, addDiagnostic);
    const context = await this.observeContext(project.rootPath, config, asOf, addDiagnostic);
    addSourceCount("config", (config ? 1 : 0) + context.length);

    const artifacts = await this.observeArtifacts(project.rootPath, config, asOf, addDiagnostic);
    addSourceCount("files", artifacts.length);

    const sessions = await this.observeSessions(project.rootPath, addDiagnostic);
    addSourceCount("sessions", sessions.length);

    const skills = this.observeSkills(project.rootPath, config, asOf, addDiagnostic);
    addSourceCount("skills", skills.length);

    const runs = projectObservedRuns(sessions);
    const sources = (Object.keys(SOURCE_LABELS) as DiagnosticSource[]).map((source) => this.createSourceStatus(
      source,
      asOf,
      sourceCounts.get(source) ?? 0,
      sourceErrors.has(source),
      diagnostics,
    ));
    const errorSourceCount = sources.filter((source) => source.status === "error").length;

    return {
      asOf,
      project: {
        name: project.name,
        rootPath: project.rootPath,
        ...(config?.summary ? { summary: config.summary } : {}),
        context,
      },
      sources,
      runs,
      artifactCategories: (config?.artifactCategories ?? []).map(({ id, label }) => ({ id, label })),
      artifacts,
      skills,
      diagnostics,
      dataQuality: errorSourceCount === sources.length
        ? "unavailable"
        : diagnostics.some((entry) => entry.level === "error" || entry.level === "warning")
          ? "partial"
          : "complete",
    };
  };

  private readConfig = async (
    rootPath: string,
    addDiagnostic: (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details?: Pick<ProjectObservationDiagnostic, "projectRelativePath">,
    ) => void,
  ): Promise<ProjectObservationConfig | null> => {
    const path = ".nextclaw/project.yaml";
    const observed = await observeProjectFile(rootPath, path);
    if (!observed) {
      addDiagnostic("config", "info", "PROJECT_CONFIG_NOT_FOUND", "No .nextclaw/project.yaml was found.", { projectRelativePath: path });
      return null;
    }
    try {
      const result = parseProjectObservationConfig(await readFile(join(rootPath, path), "utf8"));
      for (const issue of result.issues) {
        addDiagnostic(
          "config",
          result.config ? "warning" : "error",
          issue.code,
          issue.message,
          { projectRelativePath: path },
        );
      }
      return result.config;
    } catch (error) {
      addDiagnostic(
        "config",
        "error",
        "PROJECT_CONFIG_READ_FAILED",
        error instanceof Error ? error.message : "Project config could not be read.",
        { projectRelativePath: path },
      );
      return null;
    }
  };

  private observeContext = async (
    rootPath: string,
    config: ProjectObservationConfig | null,
    asOf: string,
    addDiagnostic: (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details?: Pick<ProjectObservationDiagnostic, "projectRelativePath">,
    ) => void,
  ): Promise<ObservedProjectContextReference[]> => await Promise.all((config?.context ?? []).map(async (entry) => {
    const path = normalizeProjectRelativePath(entry.source);
    const observed = path ? await observeProjectFile(rootPath, path) : null;
    if (!observed) {
      addDiagnostic(
        "files",
        "warning",
        "PROJECT_CONTEXT_SOURCE_UNAVAILABLE",
        `Context source '${entry.source}' is unavailable or outside the project.`,
        { projectRelativePath: entry.source },
      );
    }
    return {
      ...entry,
      accessible: observed !== null,
      reference: observed
        ? projectObservationFileReference(observed.relativePath, asOf)
        : projectObservationConfigReference(asOf),
    };
  }));

  private observeArtifacts = async (
    rootPath: string,
    config: ProjectObservationConfig | null,
    asOf: string,
    addDiagnostic: (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details?: Pick<ProjectObservationDiagnostic, "projectRelativePath">,
    ) => void,
  ): Promise<ObservedArtifact[]> => {
    const result = await scanProjectArtifactFiles(rootPath, config?.artifactCategories ?? []);
    for (const issue of result.issues) {
      addDiagnostic("files", "warning", issue.code, issue.message, {
        ...(issue.projectRelativePath ? { projectRelativePath: issue.projectRelativePath } : {}),
      });
    }
    return result.matches.map((match) => ({
      id: `${match.categoryId}:${match.relativePath}`,
      path: match.relativePath,
      categoryId: match.categoryId,
      categoryLabel: match.categoryLabel,
      exists: true,
      size: match.size,
      fileCreatedAt: match.createdAt,
      fileUpdatedAt: match.updatedAt,
      references: [projectObservationFileReference(match.relativePath, asOf)],
    }));
  };

  private observeSessions = async (
    rootPath: string,
    addDiagnostic: (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details?: Pick<ProjectObservationDiagnostic, "sessionId" | "messageId">,
    ) => void,
  ): Promise<NcpSessionSummary[]> => {
    try {
      return (await this.options.sessionManager.listSessions())
        .filter((session) => readSessionProjectRoot(session) === rootPath);
    } catch (error) {
      addDiagnostic("sessions", "error", "PROJECT_SESSIONS_READ_FAILED", error instanceof Error ? error.message : "Project sessions could not be listed.");
      return [];
    }
  };

  private observeSkills = (
    rootPath: string,
    config: ProjectObservationConfig | null,
    asOf: string,
    addDiagnostic: (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details?: Pick<ProjectObservationDiagnostic, "projectRelativePath">,
    ) => void,
  ): ObservedSkill[] => {
    const output = new Map<string, ObservedSkill>();
    for (const skillRoot of config?.skillRoots ?? [".agents/skills"]) {
      const normalizedRoot = normalizeProjectRelativePath(skillRoot);
      if (!normalizedRoot) {
        addDiagnostic("skills", "warning", "PROJECT_SKILL_ROOT_INVALID", `Skill root '${skillRoot}' is outside the project.`, { projectRelativePath: skillRoot });
        continue;
      }
      try {
        const loader = new SkillsLoader({
          workspace: this.options.workspacePath,
          projectRoot: rootPath,
          projectSkillsDirName: normalizedRoot,
          includeBuiltin: false,
          includeGlobal: false,
        });
        for (const skill of loader.listSkills(false).filter((entry) => entry.scope === "project")) {
          const metadata = loader.getSkillMetadata(skill) ?? {};
          const relativePath = normalizeProjectRelativePath(skill.path.slice(rootPath.length + 1)) ?? `${normalizedRoot}/${skill.name}/SKILL.md`;
          output.set(skill.ref, {
            ref: skill.ref,
            name: skill.name,
            ...(metadata.description ? { description: metadata.description } : {}),
            source: "project",
            path: relativePath,
            readable: true,
            reference: projectObservationFileReference(relativePath, asOf),
          });
        }
      } catch (error) {
        addDiagnostic("skills", "error", "PROJECT_SKILLS_READ_FAILED", error instanceof Error ? error.message : "Project skills could not be read.", { projectRelativePath: normalizedRoot });
      }
    }
    return [...output.values()].sort((left, right) => left.name.localeCompare(right.name));
  };

  private createSourceStatus = (
    source: DiagnosticSource,
    asOf: string,
    itemCount: number,
    hasError: boolean,
    diagnostics: ProjectObservationDiagnostic[],
  ): ProjectObservationSourceStatus => ({
    id: source,
    label: SOURCE_LABELS[source],
    status: hasError ? "error" : itemCount > 0 ? "available" : "empty",
    itemCount,
    observedAt: asOf,
    diagnosticIds: diagnostics.filter((entry) => entry.source === source).map((entry) => entry.id),
  });
}
