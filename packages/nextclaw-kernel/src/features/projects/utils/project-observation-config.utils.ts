import { parse as parseYaml } from "yaml";

export type ProjectObservationConfigContext = {
  id: string;
  role: string;
  source: string;
};

export type ProjectObservationArtifactCategory = {
  id: string;
  label: string;
  include: string[];
};

export type ProjectObservationConfig = {
  summary?: string;
  context: ProjectObservationConfigContext[];
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
  issues.push(...collectUnknownKeyIssues(parsed, ["schema_version", "project", "observation"], "project.yaml"));
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
  issues.push(...collectUnknownKeyIssues(observation, ["artifacts", "skills"], "observation"));
  const context = parseContext(project.context);
  const artifactCategories = parseArtifactCategories(observation.artifacts);
  const skillRoots = parseSkillRoots(observation.skills);
  issues.push(...context.issues, ...artifactCategories.issues, ...skillRoots.issues);
  return {
    config: {
      ...(readString(project.summary) ? { summary: readString(project.summary)! } : {}),
      context: context.value,
      artifactCategories: artifactCategories.value,
      skillRoots: skillRoots.value,
    },
    issues,
  };
}
