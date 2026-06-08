import path from "node:path";

import { isKebabSegment } from "./file-name-kebab-shared.mjs";

const ROOT_DIRECTORY_ALLOWLIST = new Set([
  ".agents",
  ".skild"
]);

const DIRECTORY_SEGMENT_ALLOWLIST = new Set([
  "__tests__",
  "tests",
  "__fixtures__",
  "fixtures",
  "generated",
  "migrations",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vite",
  ".vitepress",
  "ui-dist",
  "out",
  "tmp",
  "release",
  ".skild"
]);

const VERSION_DIRECTORY_PATTERN = /^v\d+\.\d+\.\d+(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const DATE_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

const toPosixPath = (filePath) => filePath.split(path.sep).join(path.posix.sep);

export const isAllowedDirectorySegment = (segment, segmentIndex) => {
  if (!segment) {
    return false;
  }
  if (segmentIndex === 0 && ROOT_DIRECTORY_ALLOWLIST.has(segment)) {
    return true;
  }
  if (DIRECTORY_SEGMENT_ALLOWLIST.has(segment)) {
    return true;
  }
  if (VERSION_DIRECTORY_PATTERN.test(segment) || DATE_DIRECTORY_PATTERN.test(segment)) {
    return true;
  }
  return isKebabSegment(segment);
};

export const collectDirectoryNameViolationsForFilePath = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return [];
  }

  const violations = [];
  const directorySegments = segments.slice(0, -1);
  for (let index = 0; index < directorySegments.length; index += 1) {
    const segment = directorySegments[index];
    if (isAllowedDirectorySegment(segment, index)) {
      continue;
    }
    violations.push({
      filePath: normalizedPath,
      directoryPath: directorySegments.slice(0, index + 1).join("/"),
      segment
    });
  }

  return violations;
};
