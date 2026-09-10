import fs from "node:fs";
import path from "node:path";

import { wikiSkillNames } from "./skill-progressive-loading.constants.mjs";

export const walkFiles = (directoryPath, predicate) => {
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

export const relativeToRepo = (repoRoot, filePath) => path.relative(repoRoot, filePath);

export const parseFrontmatter = (text) => {
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

export const collectSkillEntries = ({ budgets, repoRoot, skillsRoot }) => {
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
    if (!name) violations.push(`${file}: missing frontmatter name`);
    if (!description) violations.push(`${file}: missing frontmatter description`);
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

export const indexSkillEntries = (skillEntries) => {
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

export const validateTopLevelSkillPlacement = ({ skillEntries, skillsRoot }) =>
  skillEntries
    .filter((entry) => path.relative(skillsRoot, entry.path).split(path.sep).length !== 2)
    .map((entry) => `${entry.file}: discoverable skills must be direct children of .agents/skills`);

export const validateWikiSkillHierarchy = ({
  enforceWikiSkillCatalog,
  repoRoot,
  topLevelEntriesByName,
  wikiRoot,
  wikiSkillEntries,
  wikiSkillsRoot
}) => {
  const violations = [];
  const wikiFiles = walkFiles(wikiRoot, () => true);
  for (const filePath of wikiFiles) {
    const file = relativeToRepo(repoRoot, filePath);
    if (path.basename(filePath) === "SKILL.md") {
      const relativeSkillPath = path.relative(wikiSkillsRoot, filePath);
      if (relativeSkillPath.startsWith("..") || path.isAbsolute(relativeSkillPath)) {
        violations.push(`${file}: Wiki SKILL.md must live under .agents/wiki/skills`);
      } else if (relativeSkillPath.split(path.sep).length < 3) {
        violations.push(`${file}: Wiki skills must include at least one grouping directory`);
      }
      continue;
    }
    if (!filePath.endsWith(".md")) continue;
    const frontmatter = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
    if (frontmatter?.has("name") || frontmatter?.has("description")) {
      violations.push(`${file}: non-skill Wiki Markdown must not declare skill frontmatter`);
    }
  }

  const wikiEntriesByName = new Map(wikiSkillEntries.map((entry) => [entry.name, entry]));
  for (const skillName of wikiSkillNames) {
    if (enforceWikiSkillCatalog && !wikiEntriesByName.has(skillName)) {
      violations.push(`${skillName}: missing grouped Wiki skill`);
    }
    if (topLevelEntriesByName.has(skillName)) {
      violations.push(`${skillName}: grouped Wiki skill must not be a top-level discoverable skill`);
    }
  }
  return violations;
};
