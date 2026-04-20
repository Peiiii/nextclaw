import path from "node:path";

import { FLAT_ROLE_DIRECTORY_NAMES } from "./module-structure-contracts.mjs";

const looksLikeFileSegment = (segment) => Boolean(path.posix.extname(segment));

export const evaluateFlatRoleDirectoryFindings = ({
  filePath,
  segments,
  level,
  reason,
  roleDirectoryIndex,
  ownerLabel
}) => {
  const roleDirectoryName = segments[roleDirectoryIndex];
  const nestedDirectoryName = segments[roleDirectoryIndex + 1];
  if (
    !roleDirectoryName ||
    !nestedDirectoryName ||
    !FLAT_ROLE_DIRECTORY_NAMES.has(roleDirectoryName) ||
    looksLikeFileSegment(nestedDirectoryName)
  ) {
    return [];
  }

  return [{
    filePath,
    line: 1,
    column: 1,
    ownerLine: 1,
    level,
    message: `${ownerLabel}${roleDirectoryName}/ may only contain direct files; nested directory '${nestedDirectoryName}/' is not allowed`,
    reason
  }];
};
