import path from "node:path";

import {
  DOC_NAMING_ROOTS,
  normalizeGovernancePath
} from "./touched-legacy-governance-contracts.mjs";
import { isKebabSegment, toKebabSegment } from "./file-name-kebab-shared.mjs";

const DOC_EXTENSIONS = new Set([".md", ".mdx"]);
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}-/;
const KNOWLEDGE_DOC_ROLE_BY_ROOT = { "docs/thoughts": "thought", "docs/designs": "design", "docs/plans": "plan" };
const DOC_EXACT_STEM_ALLOWLIST = new Set(
  ["README", "CHANGELOG", "RELEASE", "VALIDATION", "ACCEPTANCE", "ITERATION", "TODO", "ROADMAP", "USAGE", "VISION", "ARCHITECTURE", "SKILL", "index"]
);

export const isGovernedDocFile = (filePath) => {
  const normalizedPath = normalizeGovernancePath(filePath);
  return DOC_EXTENSIONS.has(path.posix.extname(normalizedPath))
    && DOC_NAMING_ROOTS.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`));
};

const getKnowledgeDocRole = (filePath) => KNOWLEDGE_DOC_ROLE_BY_ROOT[filePath.split("/").slice(0, 2).join("/")];

const applyKnowledgeDocNaming = (filePath, stem) => {
  const role = getKnowledgeDocRole(filePath);
  if (!role) {
    return stem;
  }

  const datedStem = DATE_PREFIX_PATTERN.test(stem) ? stem : `YYYY-MM-DD-${stem}`;
  const roleStem = datedStem.endsWith(`-${role}`) ? datedStem.slice(0, -role.length - 1) : datedStem;
  return roleStem.endsWith(`.${role}`) ? roleStem : `${roleStem}.${role}`;
};

export const suggestDocKebabFilePath = (filePath) => {
  const normalizedPath = normalizeGovernancePath(filePath);
  const directoryPath = path.posix.dirname(normalizedPath);
  const extension = path.posix.extname(normalizedPath);
  const stem = path.posix.basename(normalizedPath, extension);
  const kebabStem = stem
    .split(".")
    .map((segment) => DOC_EXACT_STEM_ALLOWLIST.has(segment) ? segment : toKebabSegment(segment))
    .join(".");
  const nextStem = applyKnowledgeDocNaming(normalizedPath, kebabStem);
  const nextBaseName = `${nextStem}${extension}`;

  return directoryPath === "." || directoryPath === "" ? nextBaseName : path.posix.join(directoryPath, nextBaseName);
};

export const inspectDocKebabFilePath = (filePath) => {
  if (!isGovernedDocFile(filePath)) {
    return null;
  }

  const normalizedPath = normalizeGovernancePath(filePath);
  const baseName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(baseName);
  const stem = baseName.slice(0, -extension.length);

  if (DOC_EXACT_STEM_ALLOWLIST.has(stem)) {
    return null;
  }

  const invalidSegment = stem.split(".").find((segment) => !isKebabSegment(segment));
  const knowledgeRole = getKnowledgeDocRole(normalizedPath);
  const missingDatePrefix = knowledgeRole && !DATE_PREFIX_PATTERN.test(stem);
  const missingRoleSuffix = knowledgeRole && !stem.endsWith(`.${knowledgeRole}`);
  if (!invalidSegment && !missingDatePrefix && !missingRoleSuffix) {
    return null;
  }
  if (!invalidSegment) {
    const reason = [
      missingDatePrefix && "thought/design/plan document file name must start with 'YYYY-MM-DD-'",
      missingRoleSuffix && `thought/design/plan document file name must end with '.${knowledgeRole}'`
    ].filter(Boolean).join(" and ");

    return {
      filePath: normalizedPath,
      baseName,
      invalidSegment: stem,
      suggestedPath: suggestDocKebabFilePath(normalizedPath),
      legacyBacklog: missingDatePrefix,
      reason
    };
  }

  return {
    filePath: normalizedPath,
    baseName,
    invalidSegment,
    suggestedPath: suggestDocKebabFilePath(normalizedPath),
    reason: `document file name segment '${invalidSegment}' is not kebab-case`
  };
};
