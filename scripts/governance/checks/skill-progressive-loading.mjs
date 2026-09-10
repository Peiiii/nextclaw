#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectSkillEntries,
  indexSkillEntries,
  parseFrontmatter,
  relativeToRepo,
  validateTopLevelSkillPlacement,
  validateWikiSkillHierarchy,
  walkFiles
} from "./skill-progressive-loading.catalog.mjs";
import {
  acceptanceContractSkillName,
  defaultSkillBudgets,
  developmentLifecycleSkillName,
  developmentStageSkillNames,
  retiredSkillNames
} from "./skill-progressive-loading.constants.mjs";

export {
  acceptanceContractSkillName,
  defaultSkillBudgets,
  developmentLifecycleSkillName,
  developmentStageSkillNames,
  retiredSkillNames,
  wikiSkillNames
} from "./skill-progressive-loading.constants.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), "../../..");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const containsSkillName = (text, skillName) =>
  new RegExp(`(^|[^a-z0-9-])${escapeRegExp(skillName)}(?=$|[^a-z0-9-])`).test(text);

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

const validateActiveMarkdown = ({ repoRoot, retiredNames, skillsRoot, wikiRoot }) => {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const commandsPath = path.join(repoRoot, "commands/commands.md");
  const violations = [];
  const skillMarkdownPaths = walkFiles(skillsRoot, (filePath) => filePath.endsWith(".md"));
  const wikiMarkdownPaths = walkFiles(wikiRoot, (filePath) => filePath.endsWith(".md"));
  const activeMarkdownPaths = [
    agentsPath,
    commandsPath,
    ...skillMarkdownPaths,
    ...wikiMarkdownPaths
  ].filter((filePath) => fs.existsSync(filePath));

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
  [".agents/wiki/skills/process/acceptance-contract-governance/SKILL.md", ["active contract", "stable acceptance IDs"]],
  [".agents/wiki/skills/process/acceptance-contract-governance/references/acceptance-contract-method.md", ["`contract-id`", "`parent-goal`", "`scope-confirmation: user-confirmed`", "`acceptance_updates`", "`parent_status:", "`active-contract`", "`open-required`", "全部 `Required: true` ID 当前均为"]],
  [".agents/skills/development-lifecycle/SKILL.md", [acceptanceContractSkillName, "Required acceptance IDs", "`parent_status`", "scope reduction", "上下文压缩"]],
  [".agents/skills/development-delivery/SKILL.md", ["`acceptance_updates`", "`parent_status`", "completion gate"]],
  [".agents/wiki/skills/operations/nextclaw-npm-release/SKILL.md", ["stable acceptance IDs", "`acceptance_updates`", "parent-goal"]],
  [".agents/wiki/skills/operations/nextclaw-desktop-release/SKILL.md", ["stable ID", "`acceptance_updates`", "parent-goal"]]
]);

const validateAcceptanceCompletionContract = ({ repoRoot }) => {
  const violations = [];
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

const collectMetrics = ({ agentsPath, edges, skillEntries, wikiSkillEntries }) => {
  const agentsBytes = fs.existsSync(agentsPath) ? fs.statSync(agentsPath).size : 0;
  const skillTotalBytes = skillEntries.reduce((total, entry) => total + entry.bytes, 0);
  const descriptionTotalChars = skillEntries.reduce(
    (total, entry) => total + entry.description.length,
    0
  );
  const discoveryChars = skillEntries.reduce(
    (total, entry) => total + entry.name.length + entry.description.length + entry.file.length + 12,
    0
  );
  const dependencyEdges = [...edges.values()].reduce((total, dependencies) => total + dependencies.size, 0);
  return {
    agentsBytes,
    dependencyEdges,
    discoveryChars,
    descriptionTotalChars,
    skillCount: skillEntries.length,
    skillTotalBytes,
    wikiSkillCount: wikiSkillEntries.length
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
  if (metrics.discoveryChars > budgets.discoveryChars) {
    violations.push(
      `skill discovery list: ${metrics.discoveryChars} chars exceeds budget ${budgets.discoveryChars}`
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
  enforceDevelopmentLifecycle = true,
  enforceWikiSkillCatalog = enforceDevelopmentLifecycle
} = {}) => {
  const skillsRoot = path.join(repoRoot, ".agents/skills");
  const wikiRoot = path.join(repoRoot, ".agents/wiki");
  const wikiSkillsRoot = path.join(wikiRoot, "skills");
  const collectedSkills = collectSkillEntries({ budgets, repoRoot, skillsRoot });
  const { skillEntries } = collectedSkills;
  const topLevelPlacementViolations = validateTopLevelSkillPlacement({ skillEntries, skillsRoot });
  const collectedWikiSkills = collectSkillEntries({ budgets, repoRoot, skillsRoot: wikiSkillsRoot });
  const { skillEntries: wikiSkillEntries } = collectedWikiSkills;
  const allSkillEntries = [...skillEntries, ...wikiSkillEntries];
  const indexedSkills = indexSkillEntries(allSkillEntries);
  const { entriesByName } = indexedSkills;
  const topLevelEntriesByName = new Map(skillEntries.map((entry) => [entry.name, entry]));
  const activeMarkdown = validateActiveMarkdown({ repoRoot, retiredNames, skillsRoot, wikiRoot });
  const wikiViolations = validateWikiSkillHierarchy({
    enforceWikiSkillCatalog,
    repoRoot,
    topLevelEntriesByName,
    wikiRoot,
    wikiSkillEntries,
    wikiSkillsRoot
  });
  const edges = createDependencyEdges(allSkillEntries, entriesByName);
  const lifecycleViolations = enforceDevelopmentLifecycle
    ? validateDevelopmentLifecycle({ edges, entriesByName: topLevelEntriesByName })
    : [];
  const acceptanceCompletionViolations = enforceDevelopmentLifecycle
    ? validateAcceptanceCompletionContract({ repoRoot })
    : [];
  const dependencyViolations = validateDependencyCycles(edges);
  const metrics = collectMetrics({
    agentsPath: activeMarkdown.agentsPath,
    edges,
    skillEntries,
    wikiSkillEntries
  });
  const budgetViolations = validateAggregateBudgets(metrics, budgets);
  const violations = [
    ...collectedSkills.violations,
    ...topLevelPlacementViolations,
    ...collectedWikiSkills.violations,
    ...indexedSkills.violations,
    ...activeMarkdown.violations,
    ...wikiViolations,
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
  console.log(`- grouped Wiki skills: ${metrics.wikiSkillCount}`);
  console.log(`- discovery chars: ${metrics.discoveryChars}`);
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
