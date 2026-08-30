#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), "../../..");

export const defaultSkillBudgets = Object.freeze({
  agentsBytes: 12_000,
  descriptionChars: 260,
  descriptionTotalChars: 6_000,
  skillBytes: 8_000,
  skillCount: 38,
  skillTotalBytes: 162_000
});

export const developmentLifecycleSkillName = "development-lifecycle";
export const acceptanceContractSkillName = "acceptance-contract-governance";

export const developmentStageSkillNames = Object.freeze([
  "development-task-understanding",
  "development-design",
  "development-implementation",
  "development-validation",
  "development-review",
  "development-delivery",
  "development-retrospective"
]);

export const retiredSkillNames = Object.freeze([
  "collapsible-feature-root-architecture",
  "code-investigation-workflow",
  "code-review",
  "contract-driven-delivery-campaign",
  "development-discovery",
  "desktop-release-contract-guard",
  "directory-structure-governance-overview",
  "file-naming-convention",
  "goal-progress-anchor",
  "integrating-http-agent-runtime",
  "integrating-narp-stdio-runtime",
  "isolated-npm-release-worktree",
  "kernel-branch-owner-architecture",
  "layered-root-cause-analysis",
  "learning-from-failures",
  "local-source-runtime-validation",
  "long-chain-debugging",
  "marketplace-skill-publisher",
  "nextclaw-clean-implementation",
  "nextclaw-delivery-workflow",
  "nextclaw-release-notes-automation",
  "nextclaw-solution-design",
  "nextclaw-validation-workflow",
  "node-pnpm-locator",
  "npm-beta-release",
  "npm-release-contract-guard",
  "post-edit-maintainability-guard",
  "post-edit-maintainability-review",
  "proactive-work-continuation",
  "product-blog-storytelling",
  "project-os",
  "refresh-product-visual-assets",
  "role-first-file-organization",
  "smoke-testing-ncp-chat",
  "testing-local-extension-development-source",
  "classic-software-design-principles",
  "writing-beautiful-code",
  "unsigned-desktop-release-playbook"
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const containsSkillName = (text, skillName) =>
  new RegExp(`(^|[^a-z0-9-])${escapeRegExp(skillName)}(?=$|[^a-z0-9-])`).test(text);

const walkFiles = (directoryPath, predicate) => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);
    return entry.isDirectory()
      ? walkFiles(entryPath, predicate)
      : predicate(entryPath)
        ? [entryPath]
        : [];
  });
};

const relativeToRepo = (repoRoot, filePath) => path.relative(repoRoot, filePath);

const parseFrontmatter = (text) => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return null;
  }

  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const fieldMatch = line.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/i);
    if (fieldMatch) {
      fields.set(fieldMatch[1], fieldMatch[2].trim());
    }
  }
  return fields;
};

const markdownTargets = (text) => {
  const targets = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    const target = rawTarget.match(/^(\S+)/)?.[1] ?? "";
    if (target) {
      targets.push(target);
    }
  }
  return targets;
};

const isLocalMarkdownTarget = (target) =>
  !target.startsWith("#") &&
  !target.startsWith("/") &&
  !/^[a-z][a-z0-9+.-]*:/i.test(target);

const resolveMarkdownTarget = (markdownPath, target) => {
  const withoutFragment = target.split("#", 1)[0];
  try {
    return path.resolve(path.dirname(markdownPath), decodeURIComponent(withoutFragment));
  } catch {
    return path.resolve(path.dirname(markdownPath), withoutFragment);
  }
};

const findCycles = (edges) => {
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  const visit = (name) => {
    indexes.set(name, nextIndex);
    lowLinks.set(name, nextIndex);
    nextIndex += 1;
    stack.push(name);
    onStack.add(name);

    for (const dependency of edges.get(name) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(name, Math.min(lowLinks.get(name), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(name, Math.min(lowLinks.get(name), indexes.get(dependency)));
      }
    }

    if (lowLinks.get(name) !== indexes.get(name)) {
      return;
    }

    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== name);

    if (component.length > 1) {
      cycles.push(component.sort());
    }
  };

  for (const name of edges.keys()) {
    if (!indexes.has(name)) {
      visit(name);
    }
  }
  return cycles;
};

const collectSkillEntries = ({ budgets, repoRoot, skillsRoot }) => {
  const skillPaths = walkFiles(skillsRoot, (filePath) => path.basename(filePath) === "SKILL.md");
  const skillEntries = [];
  const violations = [];

  for (const skillPath of skillPaths) {
    const text = fs.readFileSync(skillPath, "utf8");
    const frontmatter = parseFrontmatter(text);
    const file = relativeToRepo(repoRoot, skillPath);
    if (!frontmatter) {
      violations.push(`${file}: missing YAML frontmatter`);
      continue;
    }

    const name = frontmatter.get("name");
    const description = frontmatter.get("description");
    if (!name) {
      violations.push(`${file}: missing frontmatter name`);
    }
    if (!description) {
      violations.push(`${file}: missing frontmatter description`);
    }
    const directoryName = path.basename(path.dirname(skillPath));
    if (name && directoryName !== name) {
      violations.push(`${file}: frontmatter name ${name} must match skill directory ${directoryName}`);
    }

    const bytes = Buffer.byteLength(text);
    if (bytes > budgets.skillBytes) {
      violations.push(`${file}: ${bytes} bytes exceeds SKILL.md budget ${budgets.skillBytes}`);
    }
    if ((description?.length ?? 0) > budgets.descriptionChars) {
      violations.push(
        `${file}: description has ${description.length} chars; budget is ${budgets.descriptionChars}`
      );
    }

    if (name) {
      skillEntries.push({ bytes, description: description ?? "", file, name, path: skillPath, text });
    }
  }
  return { skillEntries, violations };
};

const indexSkillEntries = (skillEntries) => {
  const entriesByName = new Map();
  const violations = [];
  for (const entry of skillEntries) {
    const existing = entriesByName.get(entry.name);
    if (existing) {
      violations.push(`${entry.file}: duplicate skill name ${entry.name}; first declared by ${existing.file}`);
    } else {
      entriesByName.set(entry.name, entry);
    }
  }
  return { entriesByName, violations };
};

const validateActiveMarkdown = ({ repoRoot, retiredNames, skillsRoot }) => {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const commandsPath = path.join(repoRoot, "commands/commands.md");
  const violations = [];
  const skillMarkdownPaths = walkFiles(skillsRoot, (filePath) => filePath.endsWith(".md"));
  const activeMarkdownPaths = [agentsPath, commandsPath, ...skillMarkdownPaths].filter((filePath) =>
    fs.existsSync(filePath)
  );

  for (const markdownPath of activeMarkdownPaths) {
    const text = fs.readFileSync(markdownPath, "utf8");
    const file = relativeToRepo(repoRoot, markdownPath);
    const frontmatter = parseFrontmatter(text);
    if (path.basename(markdownPath) !== "SKILL.md" && frontmatter?.has("name")) {
      violations.push(`${file}: reference Markdown must not declare skill frontmatter`);
    }
    for (const target of markdownTargets(text).filter(isLocalMarkdownTarget)) {
      const resolvedTarget = resolveMarkdownTarget(markdownPath, target);
      if (!fs.existsSync(resolvedTarget)) {
        violations.push(`${file}: broken local Markdown link ${target}`);
      }
    }

    for (const retiredName of retiredNames) {
      if (containsSkillName(text, retiredName)) {
        violations.push(`${file}: references retired skill ${retiredName}`);
      }
    }
  }
  return { agentsPath, violations };
};

const createDependencyEdges = (skillEntries, entriesByName) => {
  const edges = new Map();
  for (const entry of skillEntries) {
    const dependencies = new Set();
    for (const candidateName of entriesByName.keys()) {
      if (candidateName !== entry.name && containsSkillName(entry.text, candidateName)) {
        dependencies.add(candidateName);
      }
    }
    edges.set(entry.name, dependencies);
  }
  return edges;
};

const validateDependencyCycles = (edges) =>
  findCycles(edges).map((cycle) => `skill dependency cycle: ${cycle.join(" -> ")}`);

const validateDevelopmentLifecycle = ({ edges, entriesByName }) => {
  const requiredNames = [developmentLifecycleSkillName, ...developmentStageSkillNames];
  const violations = [];
  for (const requiredName of requiredNames) {
    if (!entriesByName.has(requiredName)) {
      violations.push(`development lifecycle: missing required owner ${requiredName}`);
    }
  }

  const lifecycleDependencies = edges.get(developmentLifecycleSkillName);
  if (lifecycleDependencies) {
    for (const stageName of developmentStageSkillNames) {
      if (!lifecycleDependencies.has(stageName)) {
        violations.push(`development lifecycle: ${developmentLifecycleSkillName} does not route ${stageName}`);
      }
    }
  }

  const coreNames = new Set(requiredNames);
  for (const stageName of developmentStageSkillNames) {
    for (const dependency of edges.get(stageName) ?? []) {
      if (coreNames.has(dependency)) {
        violations.push(`development lifecycle: stage ${stageName} must not route core owner ${dependency}`);
      }
    }
  }
  return violations;
};

const acceptanceCompletionContractSources = new Map([
  [".agents/skills/acceptance-contract-governance/SKILL.md", ["active contract", "stable acceptance IDs"]],
  [".agents/skills/acceptance-contract-governance/references/acceptance-contract-method.md", ["`contract-id`", "`parent-goal`", "`scope-confirmation: user-confirmed`", "`acceptance_updates`", "`parent_status:", "`active-contract`", "`open-required`", "全部 `Required: true` ID 当前均为"]],
  [".agents/skills/development-lifecycle/SKILL.md", [acceptanceContractSkillName, "Required acceptance IDs", "`parent_status`", "scope reduction", "上下文压缩"]],
  [".agents/skills/development-delivery/SKILL.md", ["`acceptance_updates`", "`parent_status`", "completion gate"]],
  [".agents/skills/nextclaw-npm-release/SKILL.md", ["stable acceptance IDs", "`acceptance_updates`", "parent-goal"]],
  [".agents/skills/nextclaw-desktop-release/SKILL.md", ["stable ID", "`acceptance_updates`", "parent-goal"]]
]);

const validateAcceptanceCompletionContract = ({ entriesByName, repoRoot }) => {
  const violations = [];
  if (!entriesByName.has(acceptanceContractSkillName)) violations.push(`acceptance completion contract: missing owner ${acceptanceContractSkillName}`);
  for (const [relativePath, markers] of acceptanceCompletionContractSources) {
    const filePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(filePath)) {
      violations.push(`acceptance completion contract: missing ${relativePath}`);
      continue;
    }
    const text = fs.readFileSync(filePath, "utf8");
    const missingMarkers = markers.filter((marker) => !text.includes(marker));
    violations.push(...missingMarkers.map((marker) => `acceptance completion contract: ${relativePath} missing marker ${marker}`));
  }
  return violations;
};

const collectMetrics = ({ agentsPath, edges, skillEntries }) => {
  const agentsBytes = fs.existsSync(agentsPath) ? fs.statSync(agentsPath).size : 0;
  const skillTotalBytes = skillEntries.reduce((total, entry) => total + entry.bytes, 0);
  const descriptionTotalChars = skillEntries.reduce(
    (total, entry) => total + entry.description.length,
    0
  );
  const dependencyEdges = [...edges.values()].reduce((total, dependencies) => total + dependencies.size, 0);
  return {
    agentsBytes,
    dependencyEdges,
    descriptionTotalChars,
    skillCount: skillEntries.length,
    skillTotalBytes
  };
};

const validateAggregateBudgets = (metrics, budgets) => {
  const violations = [];
  if (metrics.agentsBytes > budgets.agentsBytes) {
    violations.push(`AGENTS.md: ${metrics.agentsBytes} bytes exceeds budget ${budgets.agentsBytes}`);
  }
  if (metrics.skillTotalBytes > budgets.skillTotalBytes) {
    violations.push(
      `SKILL.md total: ${metrics.skillTotalBytes} bytes exceeds budget ${budgets.skillTotalBytes}`
    );
  }
  if (metrics.skillCount > budgets.skillCount) {
    violations.push(`skill count: ${metrics.skillCount} exceeds budget ${budgets.skillCount}`);
  }
  if (metrics.descriptionTotalChars > budgets.descriptionTotalChars) {
    violations.push(
      `description total: ${metrics.descriptionTotalChars} chars exceeds budget ${budgets.descriptionTotalChars}`
    );
  }
  return violations;
};

export const auditSkillProgressiveLoading = ({
  repoRoot = defaultRepoRoot,
  budgets = defaultSkillBudgets,
  retiredNames = retiredSkillNames,
  enforceDevelopmentLifecycle = true
} = {}) => {
  const skillsRoot = path.join(repoRoot, ".agents/skills");
  const collectedSkills = collectSkillEntries({ budgets, repoRoot, skillsRoot });
  const { skillEntries } = collectedSkills;
  const indexedSkills = indexSkillEntries(skillEntries);
  const { entriesByName } = indexedSkills;
  const activeMarkdown = validateActiveMarkdown({ repoRoot, retiredNames, skillsRoot });
  const edges = createDependencyEdges(skillEntries, entriesByName);
  const lifecycleViolations = enforceDevelopmentLifecycle
    ? validateDevelopmentLifecycle({ edges, entriesByName })
    : [];
  const acceptanceCompletionViolations = enforceDevelopmentLifecycle
    ? validateAcceptanceCompletionContract({ entriesByName, repoRoot })
    : [];
  const dependencyViolations = validateDependencyCycles(edges);
  const metrics = collectMetrics({ agentsPath: activeMarkdown.agentsPath, edges, skillEntries });
  const budgetViolations = validateAggregateBudgets(metrics, budgets);
  const violations = [
    ...collectedSkills.violations,
    ...indexedSkills.violations,
    ...activeMarkdown.violations,
    ...lifecycleViolations,
    ...acceptanceCompletionViolations,
    ...dependencyViolations,
    ...budgetViolations
  ];

  return {
    metrics,
    violations
  };
};

export const printSkillProgressiveLoadingAudit = (result) => {
  const { metrics, violations } = result;
  console.log("Skill progressive-loading audit");
  console.log(`- skills: ${metrics.skillCount}`);
  console.log(`- SKILL.md bytes: ${metrics.skillTotalBytes}`);
  console.log(`- description chars: ${metrics.descriptionTotalChars}`);
  console.log(`- AGENTS.md bytes: ${metrics.agentsBytes}`);
  console.log(`- skill dependency edges: ${metrics.dependencyEdges}`);

  if (violations.length === 0) {
    console.log("- result: PASS");
    return 0;
  }

  console.error(`- result: FAIL (${violations.length} violations)`);
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  return 1;
};

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  process.exitCode = printSkillProgressiveLoadingAudit(auditSkillProgressiveLoading());
}
