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
const getBusinessRootDirectoryName = (contract) => contract.protocol === "cli-command-first" ? "commands" : "features";
const getBusinessRootLabel = (contract) => getBusinessRootDirectoryName(contract) === "commands" ? "command" : "feature";
const getBusinessLocalDirectoryNames = (contract) => (
  contract.protocol === "cli-command-first" ? COMMAND_LOCAL_DIRECTORY_NAMES : FEATURE_LOCAL_DIRECTORY_NAMES
);
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

const evaluateBusinessProtocolFindings = ({
  filePath,
  contract,
  segments,
  existedInComparisonRef,
  repoPathExists
}) => {
  const findings = [];
  const businessRootDirectoryName = getBusinessRootDirectoryName(contract);
  const businessRootLabel = getBusinessRootLabel(contract);
  const localDirectoryNames = getBusinessLocalDirectoryNames(contract);
  const businessName = segments[1];
  const reason = buildProtocolReason(contract);
  const level = getProtocolViolationLevel(contract, existedInComparisonRef);

  if (!businessName) {
    return findings;
  }

  if (looksLikeFileSegment(businessName)) {
    findings.push(buildFinding(
      filePath,
      level,
      `files cannot live directly under '${businessRootDirectoryName}/'; create a business ${businessRootLabel} directory first`,
      reason
    ));
    return findings;
  }

  if (isReservedProtocolName(businessName)) {
    findings.push(buildFinding(
      filePath,
      level,
      `${businessRootLabel} directory '${businessName}/' uses a reserved structure name; ${businessRootDirectoryName} must use business directory names`,
      reason
    ));
    return findings;
  }

  const businessRootPath = path.posix.join(contract.modulePath, businessRootDirectoryName, businessName);
  const childEntry = segments[2];
  if (!childEntry) {
    return findings;
  }

  if (segments.length === 3) {
    if (!INDEX_FILE_NAMES.has(childEntry)) {
      findings.push(buildFinding(
        filePath,
        level,
        `${businessRootLabel} '${businessName}/' may only expose 'index.ts' or 'index.tsx' at its root; move '${childEntry}' under a role directory`,
        reason
      ));
    }
    return findings;
  }

  if (!hasIndexEntry(businessRootPath, repoPathExists)) {
    findings.push(buildFinding(
      filePath,
      level,
      `${businessRootLabel} '${businessName}/' is missing 'index.ts' or 'index.tsx' as its唯一导出入口`,
      reason
    ));
  }

  if (!localDirectoryNames.has(childEntry)) {
    findings.push(buildFinding(
      filePath,
      level,
      `directory '${childEntry}/' is outside the ${businessRootLabel}-local whitelist for '${businessName}/'`,
      reason
    ));
    return findings;
  }

  if (childEntry === "features") {
    const subFeatureName = segments[3];
    if (subFeatureName && !looksLikeFileSegment(subFeatureName) && isReservedProtocolName(subFeatureName)) {
      findings.push(buildFinding(
        filePath,
        level,
        `subfeature directory '${subFeatureName}/' uses a reserved structure name; subfeatures must use business directory names`,
        reason
      ));
    }
  }

  return findings;
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

  return findings;
};

const evaluatePlatformProtocolFindings = ({
  filePath,
  contract,
  segments,
  existedInComparisonRef,
  repoPathExists
}) => {
  const findings = [];
  const platformName = segments[1];
  const reason = buildProtocolReason(contract);
  const level = getProtocolViolationLevel(contract, existedInComparisonRef);

  if (!platformName) {
    return findings;
  }

  if (looksLikeFileSegment(platformName)) {
    findings.push(buildFinding(
      filePath,
      level,
      "files cannot live directly under 'platforms/'; create a platform directory first",
      reason
    ));
    return findings;
  }

  if (isReservedProtocolName(platformName)) {
    findings.push(buildFinding(
      filePath,
      level,
      `platform directory '${platformName}/' uses a reserved structure name; platforms should use actual platform names`,
      reason
    ));
    return findings;
  }

  const platformRootPath = path.posix.join(contract.modulePath, "platforms", platformName);
  const childEntry = segments[2];
  if (!childEntry) {
    return findings;
  }

  if (segments.length === 3) {
    if (!INDEX_FILE_NAMES.has(childEntry)) {
      findings.push(buildFinding(
        filePath,
        level,
        `platform '${platformName}/' may only expose 'index.ts' or 'index.tsx' at its root; move '${childEntry}' under a role directory`,
        reason
      ));
    }
    return findings;
  }

  if (!hasIndexEntry(platformRootPath, repoPathExists)) {
    findings.push(buildFinding(
      filePath,
      level,
      `platform '${platformName}/' is missing 'index.ts' or 'index.tsx' as its唯一导出入口`,
      reason
    ));
  }

  if (!FIXED_ROLE_DIRECTORY_NAMES.has(childEntry)) {
    findings.push(buildFinding(
      filePath,
      level,
      `platform '${platformName}/' may only contain role directories from the fixed whitelist; found '${childEntry}/'`,
      reason
    ));
  }

  return findings;
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
  return [];
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

const evaluateProtocolImportTarget = ({ currentRelativePath, targetRelativePath }) => {
  const currentBusinessBoundary = getBusinessBoundaryKey(currentRelativePath);
  const currentPlatformBoundary = getPlatformBoundaryKey(currentRelativePath);
  const currentSharedLibBoundary = getSharedLibBoundaryKey(currentRelativePath);
  const targetSegments = targetRelativePath.split("/").filter(Boolean);

  if ((targetSegments[0] === "features" || targetSegments[0] === "commands") && targetSegments[1]) {
    const targetBusinessBoundary = `${targetSegments[0]}/${targetSegments[1]}`;
    const targetBusinessLabel = targetSegments[0] === "commands" ? "command" : "feature";
    if (
      currentBusinessBoundary !== targetBusinessBoundary &&
      targetSegments.length > 2 &&
      !(targetSegments.length === 3 && isIndexLikeImportSegment(targetSegments[2]))
    ) {
      return `${targetBusinessLabel} imports must go through '${targetBusinessBoundary}' instead of deep importing '${targetRelativePath}'`;
    }
    return null;
  }

  if (targetSegments[0] === "platforms" && targetSegments[1]) {
    const targetPlatformBoundary = `platforms/${targetSegments[1]}`;
    if (
      currentPlatformBoundary !== targetPlatformBoundary &&
      targetSegments.length > 2 &&
      !(targetSegments.length === 3 && isIndexLikeImportSegment(targetSegments[2]))
    ) {
      return `platform imports must go through '${targetPlatformBoundary}' instead of deep importing '${targetRelativePath}'`;
    }
    return null;
  }

  if (targetSegments[0] === "shared" && targetSegments[1] === "lib" && targetSegments[2]) {
    const targetSharedLibBoundary = `shared/lib/${targetSegments[2]}`;
    if (
      currentSharedLibBoundary !== targetSharedLibBoundary &&
      targetSegments.length > 3 &&
      !(targetSegments.length === 4 && isIndexLikeImportSegment(targetSegments[3]))
    ) {
      return `shared/lib imports must go through '${targetSharedLibBoundary}' instead of deep importing '${targetRelativePath}'`;
    }
    return null;
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
