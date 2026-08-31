import { parse as parseYaml } from "yaml";
import { PROJECT_OBSERVATION_PROTOCOL } from "@kernel/features/projects/types/project-observation.types.js";

export type ProjectObservationConfigContext = {
  id: string;
  role: string;
  source: string;
};

export type ProjectObservationConfigWorkflow = {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string }>;
};

export type ProjectObservationArtifactCategory = {
  id: string;
  label: string;
  include: string[];
};

export type ProjectObservationConfig = {
  summary?: string;
  context: ProjectObservationConfigContext[];
  workflows: ProjectObservationConfigWorkflow[];
  artifactCategories: ProjectObservationArtifactCategory[];
  skillRoots: string[];
};

export type ProjectObservationConfigIssue = {
  code: string;
  message: string;
};

export type ProjectObservationConfigParseResult = {
  config: ProjectObservationConfig | null;
  issues: ProjectObservationConfigIssue[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
};

type ParsedConfigSection<T> = {
  value: T;
  issues: ProjectObservationConfigIssue[];
};

const collectUnknownKeyIssues = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  owner: string,
): ProjectObservationConfigIssue[] => Object.keys(value).flatMap((key) =>
  allowed.includes(key)
    ? []
    : [{
        code: "PROJECT_CONFIG_UNKNOWN_FIELD",
        message: `${owner} contains unknown field '${key}'.`,
      }]
);

function parseContext(
  value: unknown,
): ParsedConfigSection<ProjectObservationConfigContext[]> {
  if (value === undefined) {
    return { value: [], issues: [] };
  }
  if (!Array.isArray(value)) {
    return {
      value: [],
      issues: [{ code: "PROJECT_CONFIG_CONTEXT_INVALID", message: "project.context must be an array." }],
    };
  }
  const issues: ProjectObservationConfigIssue[] = [];
  const context = value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ code: "PROJECT_CONFIG_CONTEXT_INVALID", message: `project.context[${index}] must be an object.` });
      return [];
    }
    issues.push(...collectUnknownKeyIssues(entry, ["id", "role", "source"], `project.context[${index}]`));
    const id = readString(entry.id);
    const role = readString(entry.role);
    const source = readString(entry.source);
    if (!id || !role || !source) {
      issues.push({ code: "PROJECT_CONFIG_CONTEXT_INVALID", message: `project.context[${index}] requires id, role and source.` });
      return [];
    }
    return [{ id, role, source }];
  });
  return { value: context, issues };
}

function parseWorkflows(
  value: unknown,
): ParsedConfigSection<ProjectObservationConfigWorkflow[]> {
  if (value === undefined) {
    return { value: [], issues: [] };
  }
  if (!Array.isArray(value)) {
    return {
      value: [],
      issues: [{ code: "PROJECT_CONFIG_WORKFLOWS_INVALID", message: "workflows must be an array." }],
    };
  }
  const issues: ProjectObservationConfigIssue[] = [];
  const workflows = value.flatMap((entry, workflowIndex) => {
    if (!isRecord(entry) || !Array.isArray(entry.stages)) {
      issues.push({ code: "PROJECT_CONFIG_WORKFLOW_INVALID", message: `workflows[${workflowIndex}] requires a stages array.` });
      return [];
    }
    issues.push(...collectUnknownKeyIssues(entry, ["id", "label", "stages"], `workflows[${workflowIndex}]`));
    const id = readString(entry.id);
    const label = readString(entry.label);
    const stages = entry.stages.flatMap((stage, stageIndex) => {
      if (!isRecord(stage)) {
        issues.push({ code: "PROJECT_CONFIG_STAGE_INVALID", message: `workflows[${workflowIndex}].stages[${stageIndex}] must be an object.` });
        return [];
      }
      issues.push(...collectUnknownKeyIssues(stage, ["id", "label"], `workflows[${workflowIndex}].stages[${stageIndex}]`));
      const stageId = readString(stage.id);
      const stageLabel = readString(stage.label);
      if (!stageId || !stageLabel) {
        issues.push({ code: "PROJECT_CONFIG_STAGE_INVALID", message: `workflows[${workflowIndex}].stages[${stageIndex}] requires id and label.` });
        return [];
      }
      return [{ id: stageId, label: stageLabel }];
    });
    if (!id || !label) {
      issues.push({ code: "PROJECT_CONFIG_WORKFLOW_INVALID", message: `workflows[${workflowIndex}] requires id and label.` });
      return [];
    }
    return [{ id, label, stages }];
  });
  return { value: workflows, issues };
}

function parseArtifactCategories(
  value: unknown,
): ParsedConfigSection<ProjectObservationArtifactCategory[]> {
  if (value === undefined) {
    return { value: [], issues: [] };
  }
  if (!Array.isArray(value)) {
    return {
      value: [],
      issues: [{ code: "PROJECT_CONFIG_ARTIFACTS_INVALID", message: "observation.artifacts must be an array." }],
    };
  }
  const issues: ProjectObservationConfigIssue[] = [];
  const artifactCategories = value.flatMap((entry, index) => {
    if (!isRecord(entry) || !Array.isArray(entry.include)) {
      issues.push({ code: "PROJECT_CONFIG_ARTIFACT_INVALID", message: `observation.artifacts[${index}] requires an include array.` });
      return [];
    }
    issues.push(...collectUnknownKeyIssues(entry, ["id", "label", "include"], `observation.artifacts[${index}]`));
    const id = readString(entry.id);
    const label = readString(entry.label);
    const include = entry.include.map(readString).filter((pattern): pattern is string => pattern !== null);
    if (!id || !label || include.length !== entry.include.length || include.length === 0) {
      issues.push({ code: "PROJECT_CONFIG_ARTIFACT_INVALID", message: `observation.artifacts[${index}] requires id, label and non-empty string patterns.` });
      return [];
    }
    return [{ id, label, include }];
  });
  return { value: artifactCategories, issues };
}

function parseSkillRoots(
  value: unknown,
): ParsedConfigSection<string[]> {
  if (value === undefined) {
    return { value: [".agents/skills"], issues: [] };
  }
  if (!Array.isArray(value)) {
    return {
      value: [],
      issues: [{ code: "PROJECT_CONFIG_SKILLS_INVALID", message: "observation.skills must be an array." }],
    };
  }
  const issues: ProjectObservationConfigIssue[] = [];
  const skillRoots = value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ code: "PROJECT_CONFIG_SKILL_INVALID", message: `observation.skills[${index}] must be an object.` });
      return [];
    }
    issues.push(...collectUnknownKeyIssues(entry, ["root"], `observation.skills[${index}]`));
    const root = readString(entry.root);
    if (!root) {
      issues.push({ code: "PROJECT_CONFIG_SKILL_INVALID", message: `observation.skills[${index}] requires root.` });
      return [];
    }
    return [root];
  });
  return { value: skillRoots, issues };
}

export function parseProjectObservationConfig(source: string): ProjectObservationConfigParseResult {
  const issues: ProjectObservationConfigIssue[] = [];
  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch (error) {
    return {
      config: null,
      issues: [{
        code: "PROJECT_CONFIG_YAML_INVALID",
        message: error instanceof Error ? error.message : "project.yaml is invalid YAML.",
      }],
    };
  }
  if (!isRecord(parsed)) {
    return { config: null, issues: [{ code: "PROJECT_CONFIG_INVALID", message: "project.yaml must contain an object." }] };
  }
  issues.push(...collectUnknownKeyIssues(parsed, ["schema_version", "project", "workflows", "observation"], "project.yaml"));
  if (parsed.schema_version !== 1) {
    return { config: null, issues: [{ code: "PROJECT_CONFIG_VERSION_UNSUPPORTED", message: "Only schema_version 1 is supported." }, ...issues] };
  }
  const project = isRecord(parsed.project) ? parsed.project : {};
  const observation = isRecord(parsed.observation) ? parsed.observation : {};
  if (parsed.project !== undefined && !isRecord(parsed.project)) {
    issues.push({ code: "PROJECT_CONFIG_PROJECT_INVALID", message: "project must be an object." });
  }
  if (parsed.observation !== undefined && !isRecord(parsed.observation)) {
    issues.push({ code: "PROJECT_CONFIG_OBSERVATION_INVALID", message: "observation must be an object." });
  }
  issues.push(...collectUnknownKeyIssues(project, ["summary", "context"], "project"));
  issues.push(...collectUnknownKeyIssues(observation, ["markers", "work_items", "artifacts", "skills"], "observation"));
  if (observation.markers !== undefined) {
    const markers = Array.isArray(observation.markers) ? observation.markers : [];
    const valid = markers.some((marker) => isRecord(marker) && marker.protocol === PROJECT_OBSERVATION_PROTOCOL);
    if (!valid) {
      issues.push({ code: "PROJECT_CONFIG_MARKERS_INVALID", message: `observation.markers must enable protocol '${PROJECT_OBSERVATION_PROTOCOL}'.` });
    }
  }
  const context = parseContext(project.context);
  const workflows = parseWorkflows(parsed.workflows);
  const artifactCategories = parseArtifactCategories(observation.artifacts);
  const skillRoots = parseSkillRoots(observation.skills);
  issues.push(...context.issues, ...workflows.issues, ...artifactCategories.issues, ...skillRoots.issues);
  return {
    config: {
      ...(readString(project.summary) ? { summary: readString(project.summary)! } : {}),
      context: context.value,
      workflows: workflows.value,
      artifactCategories: artifactCategories.value,
      skillRoots: skillRoots.value,
    },
    issues,
  };
}
