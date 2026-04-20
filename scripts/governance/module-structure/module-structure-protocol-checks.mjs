import { existsSync } from "node:fs";
import path from "node:path";
import parser from "@typescript-eslint/parser";
import { hasAddedLineInRange, rootDir } from "../lint-new-code-governance-support.mjs";
import {
  COMMAND_LOCAL_DIRECTORY_NAMES,
  FEATURE_LOCAL_DIRECTORY_NAMES,
  FIXED_ROLE_DIRECTORY_NAMES,
  isProtocolContract,
  RESERVED_PROTOCOL_DIRECTORY_NAMES,
  toModuleRelativePath
} from "./module-structure-contracts.mjs";
import { evaluateFlatRoleDirectoryFindings } from "./module-structure-flat-role-findings.mjs";

const INDEX_FILE_NAMES = new Set(["index.ts", "index.tsx"]);
const AST_PARSE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

const buildFinding = (filePath, level, message, reason, line = 1, column = 1) => ({
  filePath,
  line,
  column,
  ownerLine: line,
  level,
  message,
  reason
});

const isGovernedCodeFile = (filePath) => AST_PARSE_EXTENSIONS.has(path.posix.extname(filePath));
const looksLikeFileSegment = (segment) => Boolean(path.posix.extname(segment));
const isIndexLikeImportSegment = (segment) => /^index(?:\.[^.]+)?(?:\.[^.]+)?$/.test(segment);
const isReservedProtocolName = (name) => RESERVED_PROTOCOL_DIRECTORY_NAMES.has(name);
const buildProtocolReason = (contract) => `protocol=${contract.protocol} module=${contract.modulePath}`;
const repoPathExistsInWorkspace = (repoPath) => existsSync(path.resolve(rootDir, repoPath));
const getProtocolViolationLevel = (contract, existedInComparisonRef) => (
  contract.rootPolicy === "contract-only"
    ? "error"
    : existedInComparisonRef ? "warn" : "error"
);
const getBusinessRootConfig = (contract) => contract.protocol === "cli-command-first"
  ? { rootDirectoryName: "commands", label: "command", localDirectoryNames: COMMAND_LOCAL_DIRECTORY_NAMES }
  : { rootDirectoryName: "features", label: "feature", localDirectoryNames: FEATURE_LOCAL_DIRECTORY_NAMES };
const getPreferredImportAliasPrefix = (contract) => {
  const prefixes = [...(contract.importAliasPrefixes ?? [])].filter(Boolean);
  return prefixes[0] ?? null;
};

const hasIndexEntry = (repoDirectoryPath, repoPathExists = repoPathExistsInWorkspace) => {
  for (const indexFileName of INDEX_FILE_NAMES) {
    if (repoPathExists(path.posix.join(repoDirectoryPath, indexFileName))) {
      return true;
    }
  }
  return false;
};

const getBusinessBoundaryKey = (relativePath) => {
  const parts = relativePath.split("/").filter(Boolean);
  if (!parts[1] || looksLikeFileSegment(parts[1])) {
    return null;
  }
  return (parts[0] === "features" || parts[0] === "commands")
    ? `${parts[0]}/${parts[1]}`
    : null;
};

const getPlatformBoundaryKey = (relativePath) => {
  const parts = relativePath.split("/").filter(Boolean);
  return parts[0] === "platforms" && parts[1] && !looksLikeFileSegment(parts[1])
    ? `platforms/${parts[1]}`
    : null;
};

const getSharedLibBoundaryKey = (relativePath) => {
  const parts = relativePath.split("/").filter(Boolean);
  return parts[0] === "shared" && parts[1] === "lib" && parts[2] && !looksLikeFileSegment(parts[2])
    ? `shared/lib/${parts[2]}`
    : null;
};

const evaluateNamedProtocolRootFindings = ({
  filePath,
  contract,
  segments,
  existedInComparisonRef,
  repoPathExists,
  rootDirectoryName,
  allowedChildDirectories,
  invalidRootFileMessage,
  reservedNameMessage,
  invalidRootEntryMessage,
  missingIndexMessage,
  invalidChildDirectoryMessage
}) => {
  const findings = [];
  const name = segments[1];
  const reason = buildProtocolReason(contract);
  const level = getProtocolViolationLevel(contract, existedInComparisonRef);

  if (!name) {
    return findings;
  }
  if (looksLikeFileSegment(name)) {
    findings.push(buildFinding(filePath, level, invalidRootFileMessage, reason));
    return findings;
  }
  if (isReservedProtocolName(name)) {
    findings.push(buildFinding(filePath, level, reservedNameMessage(name), reason));
    return findings;
  }

  const childEntry = segments[2];
  if (!childEntry) {
    return findings;
  }
  if (segments.length === 3) {
    if (!INDEX_FILE_NAMES.has(childEntry)) {
      findings.push(buildFinding(filePath, level, invalidRootEntryMessage(name, childEntry), reason));
    }
    return findings;
  }

  if (!hasIndexEntry(path.posix.join(contract.modulePath, rootDirectoryName, name), repoPathExists)) {
    findings.push(buildFinding(filePath, level, missingIndexMessage(name), reason));
  }
  if (!allowedChildDirectories.has(childEntry)) {
    findings.push(buildFinding(filePath, level, invalidChildDirectoryMessage(name, childEntry), reason));
  }
  return findings;
};

const evaluateBusinessProtocolFindings = ({
  filePath,
  contract,
  segments,
  existedInComparisonRef,
  repoPathExists
}) => {
  const { rootDirectoryName, label, localDirectoryNames } = getBusinessRootConfig(contract);
  const childEntry = segments[2];
  const findings = evaluateNamedProtocolRootFindings({
    filePath,
    contract,
    segments,
    existedInComparisonRef,
    repoPathExists,
    rootDirectoryName,
    allowedChildDirectories: localDirectoryNames,
    invalidRootFileMessage: `files cannot live directly under '${rootDirectoryName}/'; create a business ${label} directory first`,
    reservedNameMessage: (businessName) => `${label} directory '${businessName}/' uses a reserved structure name; ${rootDirectoryName} must use business directory names`,
    invalidRootEntryMessage: (businessName, childEntry) => `${label} '${businessName}/' may only expose 'index.ts' or 'index.tsx' at its root; move '${childEntry}' under a role directory`,
    missingIndexMessage: (businessName) => `${label} '${businessName}/' is missing 'index.ts' or 'index.tsx' as its唯一导出入口`,
    invalidChildDirectoryMessage: (businessName, childEntry) => `directory '${childEntry}/' is outside the ${label}-local whitelist for '${businessName}/'`
  });
  if (childEntry === "features") {
    const subFeatureName = segments[3];
    if (subFeatureName && !looksLikeFileSegment(subFeatureName) && isReservedProtocolName(subFeatureName)) {
      findings.push(buildFinding(
        filePath,
        getProtocolViolationLevel(contract, existedInComparisonRef),
        `subfeature directory '${subFeatureName}/' uses a reserved structure name; subfeatures must use business directory names`,
        buildProtocolReason(contract)
      ));
    }
  }

  return [
    ...findings,
    ...evaluateFlatRoleDirectoryFindings({
      filePath,
      segments,
      level: getProtocolViolationLevel(contract, existedInComparisonRef),
      reason: buildProtocolReason(contract),
      roleDirectoryIndex: 2,
      ownerLabel: `${label} '${segments[1]}/' role directory '`
    })
  ];
};

const evaluateSharedProtocolFindings = ({
  filePath,
  contract,
  segments,
  existedInComparisonRef,
  repoPathExists
}) => {
  const findings = [];
  const sharedEntry = segments[1];
  const reason = buildProtocolReason(contract);
  const level = getProtocolViolationLevel(contract, existedInComparisonRef);

  if (!sharedEntry) {
    return findings;
  }

  if (looksLikeFileSegment(sharedEntry)) {
    findings.push(buildFinding(
      filePath,
      level,
      "files cannot live directly under 'shared/'; shared root only accepts whitelisted role directories or 'lib/'",
      reason
    ));
    return findings;
  }

  if (sharedEntry === "lib") {
    const libModuleName = segments[2];
    if (!libModuleName) {
      return findings;
    }
    if (looksLikeFileSegment(libModuleName)) {
      findings.push(buildFinding(
        filePath,
        level,
        "files cannot live directly under 'shared/lib/'; create a module directory first",
        reason
      ));
      return findings;
    }

    const libModuleRootPath = path.posix.join(contract.modulePath, "shared", "lib", libModuleName);
    if (!hasIndexEntry(libModuleRootPath, repoPathExists)) {
      findings.push(buildFinding(
        filePath,
        level,
        `shared/lib module '${libModuleName}/' is missing 'index.ts' or 'index.tsx' as its唯一公共出口`,
        reason
      ));
    }
    return findings;
  }

  if (!FIXED_ROLE_DIRECTORY_NAMES.has(sharedEntry)) {
    findings.push(buildFinding(
      filePath,
      level,
      `directory '${sharedEntry}/' is outside the shared role whitelist`,
      reason
    ));
    return findings;
  }

  const sharedRoleEntry = segments[2];
  if (sharedRoleEntry && INDEX_FILE_NAMES.has(sharedRoleEntry)) {
    findings.push(buildFinding(
      filePath,
      level,
      `shared/${sharedEntry}/ forbids root-level 'index.ts' or 'index.tsx'; import concrete files instead`,
      reason
    ));
  }

  return [
    ...findings,
    ...evaluateFlatRoleDirectoryFindings({
      filePath,
      segments,
      level: getProtocolViolationLevel(contract, existedInComparisonRef),
      reason: buildProtocolReason(contract),
      roleDirectoryIndex: 1,
      ownerLabel: "shared role directory '"
    })
  ];
};

const evaluatePlatformProtocolFindings = ({
  filePath,
  contract,
  segments,
  existedInComparisonRef,
  repoPathExists
}) => {
  return [
    ...evaluateNamedProtocolRootFindings({
      filePath,
      contract,
      segments,
      existedInComparisonRef,
      repoPathExists,
      rootDirectoryName: "platforms",
      allowedChildDirectories: FIXED_ROLE_DIRECTORY_NAMES,
      invalidRootFileMessage: "files cannot live directly under 'platforms/'; create a platform directory first",
      reservedNameMessage: (platformName) => `platform directory '${platformName}/' uses a reserved structure name; platforms should use actual platform names`,
      invalidRootEntryMessage: (platformName, childEntry) => `platform '${platformName}/' may only expose 'index.ts' or 'index.tsx' at its root; move '${childEntry}' under a role directory`,
      missingIndexMessage: (platformName) => `platform '${platformName}/' is missing 'index.ts' or 'index.tsx' as its唯一导出入口`,
      invalidChildDirectoryMessage: (platformName, childEntry) => `platform '${platformName}/' may only contain role directories from the fixed whitelist; found '${childEntry}/'`
    }),
    ...evaluateFlatRoleDirectoryFindings({
      filePath,
      segments,
      level: getProtocolViolationLevel(contract, existedInComparisonRef),
      reason: buildProtocolReason(contract),
      roleDirectoryIndex: 2,
      ownerLabel: `platform '${segments[1]}/' role directory '`
    })
  ];
};

export const evaluateProtocolStructureFindings = ({
  filePath,
  contract,
  existedInComparisonRef,
  repoPathExists = repoPathExistsInWorkspace
}) => {
  if (!isProtocolContract(contract)) {
    return [];
  }

  const relativePath = toModuleRelativePath(filePath, contract);
  if (!relativePath) {
    return [];
  }

  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [];
  }

  if (segments[0] === "features" || segments[0] === "commands") {
    return evaluateBusinessProtocolFindings({ filePath, contract, segments, existedInComparisonRef, repoPathExists });
  }
  if (segments[0] === "shared") {
    return evaluateSharedProtocolFindings({ filePath, contract, segments, existedInComparisonRef, repoPathExists });
  }
  if (segments[0] === "platforms") {
    return evaluatePlatformProtocolFindings({ filePath, contract, segments, existedInComparisonRef, repoPathExists });
  }
  return evaluateFlatRoleDirectoryFindings({
    filePath,
    segments,
    level: getProtocolViolationLevel(contract, existedInComparisonRef),
    reason: buildProtocolReason(contract),
    roleDirectoryIndex: 0,
    ownerLabel: "root role directory '"
  });
};

const resolveImportTargetRelativePath = (importSource, filePath, contract) => {
  if (typeof importSource !== "string" || !importSource) {
    return null;
  }

  for (const aliasPrefix of contract.importAliasPrefixes ?? []) {
    if (importSource.startsWith(aliasPrefix)) {
      return importSource.slice(aliasPrefix.length).replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
    }
  }

  if (!importSource.startsWith(".")) {
    return null;
  }

  const currentRelativePath = toModuleRelativePath(filePath, contract);
  if (!currentRelativePath) {
    return null;
  }

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(currentRelativePath), importSource));
  if (!resolved || resolved === "." || resolved.startsWith("../")) {
    return null;
  }
  return resolved.replace(/\/+$/, "");
};

const getDeepImportBoundaryMessage = ({
  currentBoundary,
  targetBoundary,
  targetSegments,
  boundaryIndex,
  targetRelativePath,
  label
}) => (
  currentBoundary === targetBoundary ||
  targetSegments.length <= boundaryIndex ||
  (targetSegments.length === boundaryIndex + 1 && isIndexLikeImportSegment(targetSegments[boundaryIndex]))
)
  ? null
  : `${label} imports must go through '${targetBoundary}' instead of deep importing '${targetRelativePath}'`;

const evaluateProtocolImportTarget = ({ currentRelativePath, targetRelativePath }) => {
  const currentBusinessBoundary = getBusinessBoundaryKey(currentRelativePath);
  const currentPlatformBoundary = getPlatformBoundaryKey(currentRelativePath);
  const currentSharedLibBoundary = getSharedLibBoundaryKey(currentRelativePath);
  const targetSegments = targetRelativePath.split("/").filter(Boolean);

  if ((targetSegments[0] === "features" || targetSegments[0] === "commands") && targetSegments[1]) {
    return getDeepImportBoundaryMessage({
      currentBoundary: currentBusinessBoundary,
      targetBoundary: `${targetSegments[0]}/${targetSegments[1]}`,
      targetSegments,
      boundaryIndex: 2,
      targetRelativePath,
      label: targetSegments[0] === "commands" ? "command" : "feature"
    });
  }

  if (targetSegments[0] === "platforms" && targetSegments[1]) {
    return getDeepImportBoundaryMessage({
      currentBoundary: currentPlatformBoundary,
      targetBoundary: `platforms/${targetSegments[1]}`,
      targetSegments,
      boundaryIndex: 2,
      targetRelativePath,
      label: "platform"
    });
  }

  if (targetSegments[0] === "shared" && targetSegments[1] === "lib" && targetSegments[2]) {
    return getDeepImportBoundaryMessage({
      currentBoundary: currentSharedLibBoundary,
      targetBoundary: `shared/lib/${targetSegments[2]}`,
      targetSegments,
      boundaryIndex: 3,
      targetRelativePath,
      label: "shared/lib"
    });
  }

  if (
    targetSegments[0] === "shared" &&
    (targetSegments[1] === "components" || targetSegments[1] === "hooks" || targetSegments[1] === "types") &&
    targetSegments.length === 2
  ) {
    return `shared/${targetSegments[1]} forbids root barrel imports; import a concrete file instead`;
  }

  return null;
};

export const evaluateProtocolImportBoundaryFindings = ({
  filePath,
  source,
  addedLines,
  contract
}) => {
  if (!isProtocolContract(contract) || !isGovernedCodeFile(filePath)) {
    return [];
  }

  const currentRelativePath = toModuleRelativePath(filePath, contract);
  if (!currentRelativePath) {
    return [];
  }

  const ast = parser.parse(source, {
    sourceType: "module",
    ecmaVersion: "latest",
    ecmaFeatures: {
      jsx: filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
    },
    loc: true,
    range: true
  });

  const findings = [];
  for (const statement of ast.body) {
    if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string") {
      continue;
    }

    const importSource = statement.source.value;
    const targetRelativePath = resolveImportTargetRelativePath(importSource, filePath, contract);
    if (!targetRelativePath) {
      continue;
    }

    const aliasPrefix = getPreferredImportAliasPrefix(contract);
    if (aliasPrefix && importSource.startsWith("../")) {
      const importWasAdded = addedLines && hasAddedLineInRange(addedLines, statement.loc.start.line, statement.loc.end.line);
      findings.push(buildFinding(
        filePath,
        importWasAdded || contract.rootPolicy === "contract-only" ? "error" : "warn",
        `cross-directory imports must use '${aliasPrefix}' instead of parent-relative '${importSource}'; only same-directory './' imports are allowed once alias imports are configured`,
        buildProtocolReason(contract),
        statement.loc.start.line,
        statement.loc.start.column + 1
      ));
      continue;
    }

    const violationMessage = evaluateProtocolImportTarget({ currentRelativePath, targetRelativePath });
    if (!violationMessage) {
      continue;
    }

    const importWasAdded = addedLines && hasAddedLineInRange(addedLines, statement.loc.start.line, statement.loc.end.line);
    findings.push(buildFinding(
      filePath,
      importWasAdded || contract.rootPolicy === "contract-only" ? "error" : "warn",
      violationMessage,
      buildProtocolReason(contract),
      statement.loc.start.line,
      statement.loc.start.column + 1
    ));
  }

  return findings;
};
