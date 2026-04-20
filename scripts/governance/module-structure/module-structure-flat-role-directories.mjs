import path from "node:path";

import {
  findModuleStructureContract,
  FLAT_ROLE_DIRECTORY_NAMES,
  isProtocolContract,
  splitModuleRelativePath
} from "./module-structure-contracts.mjs";

const looksLikeFileSegment = (segment) => Boolean(path.posix.extname(segment));

const isFlatRoleDirectoryInsideBusinessRoot = (segments) => {
  let cursor = 0;
  while (cursor < segments.length) {
    const boundaryName = segments[cursor];
    const businessName = segments[cursor + 1];
    const roleDirectoryName = segments[cursor + 2];
    if ((boundaryName !== "features" && boundaryName !== "commands") || !businessName || looksLikeFileSegment(businessName)) {
      return false;
    }
    if (!roleDirectoryName) {
      return false;
    }
    if (FLAT_ROLE_DIRECTORY_NAMES.has(roleDirectoryName)) {
      return cursor + 2 === segments.length - 1;
    }
    if (roleDirectoryName === "features") {
      cursor += 2;
      continue;
    }
    return false;
  }
  return false;
};

export const isProtocolFlatRoleDirectory = (directoryPath) => {
  const contract = findModuleStructureContract(directoryPath);
  if (!isProtocolContract(contract)) {
    return false;
  }

  const segments = splitModuleRelativePath(directoryPath, contract);
  if (segments.length === 1) {
    return FLAT_ROLE_DIRECTORY_NAMES.has(segments[0]);
  }
  if (segments[0] === "shared" && segments.length === 2) {
    return FLAT_ROLE_DIRECTORY_NAMES.has(segments[1]);
  }
  if (segments[0] === "platforms" && segments.length === 3) {
    return FLAT_ROLE_DIRECTORY_NAMES.has(segments[2]);
  }
  if (segments[0] === "features" || segments[0] === "commands") {
    return isFlatRoleDirectoryInsideBusinessRoot(segments);
  }
  return false;
};
