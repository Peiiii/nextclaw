import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SkillsLoader } from "@nextclaw/core";
import type { NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
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
  mergeProjectObservedArtifacts,
  projectObservationConfigReference,
  projectObservationFileReference,
  projectObservedActivity,
  projectObservedRequests,
  projectObservedRuns,
  projectObservedSignals,
  projectObservedWorkItems,
} from "@kernel/features/projects/utils/project-observation-projection.utils.js";
import {
  createProjectObservationMarkerParseState,
  parseProjectObservationMarkers,
  readProjectObservationResponseMetadata,
  type ProjectObservationMarker,
  type ProjectObservationMarkerIssue,
  type ProjectObservationMarkerParseState,
} from "@kernel/features/projects/utils/project-observation-marker.utils.js";

type ProjectObservationServiceOptions = {
  projectManager: Pick<ProjectManager, "getRegisteredProject">;
  sessionManager: Pick<SessionManager, "listSessions" | "listSessionMessages">;
  workspacePath: string;
  now?: () => Date;
};

type DiagnosticSource = ProjectObservationDiagnostic["source"];

type ProjectObservationResponse = {
  requestId: string;
  decision: "confirmed" | "rejected";
  sentAt: string;
  messageId: string;
};

type ParsedProjectSessionMessage = {
  markers: ProjectObservationMarker[];
  markerIssues: ProjectObservationMarkerIssue[];
  response?: ProjectObservationResponse;
};

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

const readMessageText = (message: NcpMessage): string => message.parts
  .flatMap((part) => part.type === "text" || part.type === "rich-text" ? [part.text] : [])
  .join("\n");

const compareMarkerSource = (left: ProjectObservationMarker, right: ProjectObservationMarker): number =>
  left.timestamp.localeCompare(right.timestamp)
  || left.sessionId.localeCompare(right.sessionId)
  || left.messageId.localeCompare(right.messageId)
  || left.line - right.line;

const markerConflictKey = (marker: ProjectObservationMarker): string | null => {
  switch (marker.kind) {
    case "work-item":
    case "signal":
    case "request":
      return `${marker.kind}:${marker.id}`;
    case "schedule":
      return `${marker.kind}:${marker.itemId}`;
    case "artifact":
      return null;
  }
};

const markerSemanticValue = (marker: ProjectObservationMarker): string => {
  const { line: _line, messageId: _messageId, sessionId: _sessionId, timestamp: _timestamp, ...semantic } = marker;
  return JSON.stringify(semantic);
};

const parseProjectSessionMessage = (
  sessionId: string,
  message: NcpMessage,
  state: ProjectObservationMarkerParseState,
): ParsedProjectSessionMessage => {
  if (message.role === "assistant") {
    const parsed = parseProjectObservationMarkers({
      text: readMessageText(message),
      sessionId,
      messageId: message.id,
      timestamp: message.timestamp,
      reportInvalid: message.status === "final" || message.status === "error",
      state,
    });
    return { markers: parsed.markers, markerIssues: parsed.issues };
  }
  if (message.role !== "user") {
    return { markers: [], markerIssues: [] };
  }
  const response = readProjectObservationResponseMetadata(message.metadata);
  return {
    markers: [],
    markerIssues: [],
    ...(response ? {
      response: {
        requestId: response.requestId,
        decision: response.decision,
        sentAt: message.timestamp,
        messageId: message.id,
      },
    } : {}),
  };
};

const mergeLatestResponse = (
  responses: Map<string, Omit<ProjectObservationResponse, "requestId">>,
  response: ProjectObservationResponse,
): Map<string, Omit<ProjectObservationResponse, "requestId">> => {
  const next = new Map(responses);
  const current = next.get(response.requestId);
  if (!current || current.sentAt.localeCompare(response.sentAt) <= 0) {
    const { requestId, ...value } = response;
    next.set(requestId, value);
  }
  return next;
};

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
    addSourceCount("config", (config ? 1 : 0) + context.length + (config?.workflows.length ?? 0));

    const artifacts = await this.observeArtifacts(project.rootPath, config, asOf, addDiagnostic);
    addSourceCount("files", artifacts.length);

    const sessionObservation = await this.observeSessions(project.rootPath, addDiagnostic);
    addSourceCount("sessions", sessionObservation.sessions.length);

    const skills = this.observeSkills(project.rootPath, config, asOf, addDiagnostic);
    addSourceCount("skills", skills.length);

    const workflows = (config?.workflows ?? []).map((workflow) => ({
      ...workflow,
      reference: projectObservationConfigReference(asOf),
    }));
    const workItems = projectObservedWorkItems(sessionObservation.markers, workflows, addDiagnostic);
    const runs = projectObservedRuns(sessionObservation.sessions, sessionObservation.markers);
    const mergedArtifacts = await mergeProjectObservedArtifacts(
      project.rootPath,
      artifacts,
      config,
      sessionObservation.markers,
      addDiagnostic,
    );
    const signals = projectObservedSignals(sessionObservation.markers);
    const requests = projectObservedRequests(sessionObservation.markers, sessionObservation.responses);
    const activity = projectObservedActivity(sessionObservation.markers);
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
      workflows,
      runs,
      workItems,
      artifactCategories: (config?.artifactCategories ?? []).map(({ id, label }) => ({ id, label })),
      artifacts: mergedArtifacts,
      signals,
      requests,
      activity,
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
  ): Promise<{
    markers: ProjectObservationMarker[];
    responses: Map<string, { decision: "confirmed" | "rejected"; sentAt: string; messageId: string }>;
    sessions: NcpSessionSummary[];
  }> => {
    const markers: ProjectObservationMarker[] = [];
    let responses = new Map<string, { decision: "confirmed" | "rejected"; sentAt: string; messageId: string }>();
    let sessions: NcpSessionSummary[];
    try {
      sessions = (await this.options.sessionManager.listSessions())
        .filter((session) => readSessionProjectRoot(session) === rootPath);
    } catch (error) {
      addDiagnostic("sessions", "error", "PROJECT_SESSIONS_READ_FAILED", error instanceof Error ? error.message : "Project sessions could not be listed.");
      return { markers, responses, sessions: [] };
    }
    const messages: Array<{ message: NcpMessage; sessionId: string }> = [];
    for (const session of sessions) {
      try {
        messages.push(...(await this.options.sessionManager.listSessionMessages(session.sessionId))
          .map((message) => ({ message, sessionId: session.sessionId })));
      } catch (error) {
        addDiagnostic("sessions", "error", "PROJECT_SESSION_MESSAGES_READ_FAILED", error instanceof Error ? error.message : "Project session messages could not be read.", { sessionId: session.sessionId });
      }
    }
    messages.sort((left, right) =>
      left.message.timestamp.localeCompare(right.message.timestamp)
      || left.sessionId.localeCompare(right.sessionId)
      || left.message.id.localeCompare(right.message.id));
    const parseState = createProjectObservationMarkerParseState();
    for (const { message, sessionId } of messages) {
      const parsed = parseProjectSessionMessage(sessionId, message, parseState);
      markers.push(...parsed.markers);
      for (const issue of parsed.markerIssues) {
        addDiagnostic("sessions", "warning", issue.code, issue.message, {
          sessionId,
          messageId: message.id,
        });
      }
      if (parsed.response) {
        responses = mergeLatestResponse(responses, parsed.response);
      }
    }
    markers.sort(compareMarkerSource);
    this.addMarkerConflictDiagnostics(markers, addDiagnostic);
    return { markers, responses, sessions };
  };

  private addMarkerConflictDiagnostics = (
    markers: ProjectObservationMarker[],
    addDiagnostic: (
      source: DiagnosticSource,
      level: ProjectObservationDiagnostic["level"],
      code: string,
      message: string,
      details?: Pick<ProjectObservationDiagnostic, "sessionId" | "messageId">,
    ) => void,
  ): void => {
    const latestAtByKey = new Map<string, {
      messageId: string;
      sessionId: string;
      timestamp: string;
      value: string;
    }>();
    for (const marker of markers) {
      const key = markerConflictKey(marker);
      if (!key) continue;
      const current = latestAtByKey.get(key);
      const value = markerSemanticValue(marker);
      if (current?.timestamp === marker.timestamp &&
          (current.sessionId !== marker.sessionId || current.messageId !== marker.messageId) &&
          current.value !== value) {
        addDiagnostic(
          "sessions",
          "warning",
          "PROJECT_MARKER_CONFLICT",
          `Conflicting '${key}' markers share the same observation time; a deterministic source order was used.`,
          { sessionId: marker.sessionId, messageId: marker.messageId },
        );
      }
      latestAtByKey.set(key, {
        messageId: marker.messageId,
        sessionId: marker.sessionId,
        timestamp: marker.timestamp,
        value,
      });
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
