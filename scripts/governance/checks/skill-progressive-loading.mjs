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
  skillCount: 36,
  skillTotalBytes: 160_000
});

export const retiredSkillNames = Object.freeze([
  "collapsible-feature-root-architecture",
  "contract-driven-delivery-campaign",
  "directory-structure-governance-overview",
  "file-naming-convention",
  "goal-progress-anchor",
  "isolated-npm-release-worktree",
  "kernel-branch-owner-architecture",
  "layered-root-cause-analysis",
  "local-source-runtime-validation",
  "long-chain-debugging",
  "marketplace-skill-publisher",
  "nextclaw-clean-implementation",
  "node-pnpm-locator",
  "npm-beta-release",
  "post-edit-maintainability-review",
  "proactive-work-continuation",
  "project-os",
  "role-first-file-organization",
  "smoke-testing-ncp-chat",
  "testing-local-extension-development-source",
  "classic-software-design-principles",
  "writing-beautiful-code",
  "unsigned-desktop-release-playbook"
]);

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

const collectSkillEntries = ({ budgets, repoRoot, skillsRoot, violations }) => {
  const skillPaths = walkFiles(skillsRoot, (filePath) => path.basename(filePath) === "SKILL.md");
  const skillEntries = [];

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
  return skillEntries;
};

const indexSkillEntries = (skillEntries, violations) => {
  const entriesByName = new Map();
  for (const entry of skillEntries) {
    const existing = entriesByName.get(entry.name);
    if (existing) {
      violations.push(`${entry.file}: duplicate skill name ${entry.name}; first declared by ${existing.file}`);
    } else {
      entriesByName.set(entry.name, entry);
    }
  }
  return entriesByName;
};

const validateActiveMarkdown = ({ repoRoot, retiredNames, skillsRoot, violations }) => {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const commandsPath = path.join(repoRoot, "commands/commands.md");
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
      if (text.includes(retiredName)) {
        violations.push(`${file}: references retired skill ${retiredName}`);
      }
    }
  }
  return agentsPath;
};

const createDependencyEdges = (skillEntries, entriesByName) => {
  const edges = new Map();
  for (const entry of skillEntries) {
    const dependencies = new Set();
    for (const candidateName of entriesByName.keys()) {
      if (candidateName !== entry.name && entry.text.includes(candidateName)) {
        dependencies.add(candidateName);
      }
    }
    edges.set(entry.name, dependencies);
  }
  return edges;
};

const validateDependencyCycles = (edges, violations) => {
  for (const cycle of findCycles(edges)) {
    violations.push(`skill dependency cycle: ${cycle.join(" -> ")}`);
  }
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

const validateAggregateBudgets = (metrics, budgets, violations) => {
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
};

export const auditSkillProgressiveLoading = ({
  repoRoot = defaultRepoRoot,
  budgets = defaultSkillBudgets,
  retiredNames = retiredSkillNames
} = {}) => {
  const skillsRoot = path.join(repoRoot, ".agents/skills");
  const violations = [];
  const skillEntries = collectSkillEntries({ budgets, repoRoot, skillsRoot, violations });
  const entriesByName = indexSkillEntries(skillEntries, violations);
  const agentsPath = validateActiveMarkdown({ repoRoot, retiredNames, skillsRoot, violations });
  const edges = createDependencyEdges(skillEntries, entriesByName);
  validateDependencyCycles(edges, violations);
  const metrics = collectMetrics({ agentsPath, edges, skillEntries });
  validateAggregateBudgets(metrics, budgets, violations);

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
