import path from "node:path";

import {
  DOC_NAMING_ROOTS,
  normalizeGovernancePath
} from "./touched-legacy-governance-contracts.mjs";
import { isKebabSegment, toKebabSegment } from "./file-name-kebab-shared.mjs";

const DOC_EXTENSIONS = new Set([".md", ".mdx"]);
const DOC_EXACT_STEM_ALLOWLIST = new Set([
  "README",
  "CHANGELOG",
  "RELEASE",
  "VALIDATION",
  "ACCEPTANCE",
  "ITERATION",
  "TODO",
  "ROADMAP",
  "USAGE",
  "VISION",
  "ARCHITECTURE",
  "index"
]);

export const isGovernedDocFile = (filePath) => {
  const normalizedPath = normalizeGovernancePath(filePath);
  const extension = path.posix.extname(normalizedPath);
  if (!DOC_EXTENSIONS.has(extension)) {
    return false;
  }

  return DOC_NAMING_ROOTS.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`));
};

export const suggestDocKebabFilePath = (filePath) => {
  const normalizedPath = normalizeGovernancePath(filePath);
  const directoryPath = path.posix.dirname(normalizedPath);
  const extension = path.posix.extname(normalizedPath);
  const stem = path.posix.basename(normalizedPath, extension);
  const nextStem = stem
    .split(".")
    .map((segment) => DOC_EXACT_STEM_ALLOWLIST.has(segment) ? segment : toKebabSegment(segment))
    .join(".");
  const nextBaseName = `${nextStem}${extension}`;

  if (directoryPath === "." || directoryPath === "") {
    return nextBaseName;
  }

  return path.posix.join(directoryPath, nextBaseName);
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

  const segments = stem.split(".");
  const invalidSegment = segments.find((segment) => !isKebabSegment(segment));
  if (!invalidSegment) {
    return null;
  }

  return {
    filePath: normalizedPath,
    baseName,
    invalidSegment,
    suggestedPath: suggestDocKebabFilePath(normalizedPath),
    reason: `document file name segment '${invalidSegment}' is not kebab-case`
  };
};
