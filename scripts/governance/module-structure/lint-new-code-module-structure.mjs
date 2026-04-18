#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs,
  runGit
} from "../lint-new-code-governance-support.mjs";
import {
  findModuleStructureContract,
  getModuleRootEntryPath,
  SHARED_CONTAINER_DIRECTORY_NAMES,
  splitModuleRelativePath,
  toModuleRelativePath
} from "./module-structure-contracts.mjs";

const usage = `Usage:
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs --staged
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs --base origin/main
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs -- packages/nextclaw-ui/src/components/chat

Checks touched files against explicit module-structure contracts so crowded roots do not keep growing without subtree boundaries.`;

const SHARED_DIRECTORY_ROLE_HINT = /(service|manager|controller|presenter|provider|orchestrator|runtime|router|route|store|gateway|handler|policy|registry)\b/;

const normalizePath = (value) => `${value ?? ""}`
  .trim()
  .replace(/\\/g, "/")
  .replace(/^\.\/+/, "")
  .replace(/\/+$/, "");

const createPathExistsInRef = () => {
  const cache = new Map();

  return (ref, repoPath) => {
    const normalized = normalizePath(repoPath);
    if (!normalized) {
      return false;
    }
    const key = `${ref}:${normalized}`;
    if (cache.has(key)) {
      return cache.get(key);
    }

    const output = runGit(["ls-tree", "-r", "--name-only", ref, "--", normalized], { allowFailure: true })
      .split(/\r?\n/)
      .map((line) => normalizePath(line))
      .filter(Boolean);
    const exists = output.some((entry) => entry === normalized || entry.startsWith(`${normalized}/`));
    cache.set(key, exists);
    return exists;
  };
};

const buildFinding = (filePath, level, message, reason) => ({
  filePath,
  line: 1,
  column: 1,
  ownerLine: 1,
  level,
  message,
  reason
});

export const evaluateModuleStructureFindings = (params) => {
  const {
    filePath,
    contract,
    existedInComparisonRef,
    rootEntryExistedInComparisonRef
  } = params;

  const relativePath = toModuleRelativePath(filePath, contract);
  const segments = splitModuleRelativePath(filePath, contract);
  if (!relativePath || segments.length === 0) {
    return [];
  }

  const firstSegment = segments[0];
  const isRootFile = segments.length === 1;
  const findings = [];
  const contractReason = `contract=${contract.modulePath} model=${contract.organizationModel}`;

  if (!isRootFile) {
    if (!contract.allowedRootDirectories.has(firstSegment)) {
      findings.push(buildFinding(
        filePath,
        rootEntryExistedInComparisonRef ? "warn" : "error",
        rootEntryExistedInComparisonRef
          ? `touched file still lives under legacy root directory '${firstSegment}/' outside the module structure whitelist`
          : `new root directory '${firstSegment}/' is outside the module structure whitelist`,
        contractReason
      ));
      return findings;
    }

    if (contract.sharedDirectories.has(firstSegment) || SHARED_CONTAINER_DIRECTORY_NAMES.has(firstSegment)) {
      const basename = path.posix.basename(relativePath, path.posix.extname(relativePath)).toLowerCase();
      if (SHARED_DIRECTORY_ROLE_HINT.test(basename)) {
        findings.push(buildFinding(
          filePath,
          existedInComparisonRef ? "warn" : "error",
          existedInComparisonRef
            ? `touched legacy file under '${firstSegment}/' still looks like orchestration logic; shared containers should stay pure`
            : `new file under '${firstSegment}/' looks like orchestration logic; move it to a feature/service subtree instead of a shared container`,
          contractReason
        ));
      }
    }

    return findings;
  }

  const allowedRootFile = contract.allowedRootFiles.has(firstSegment);
  if (contract.rootPolicy === "contract-only" && !allowedRootFile) {
    findings.push(buildFinding(
      filePath,
      existedInComparisonRef ? "warn" : "error",
      existedInComparisonRef
        ? `touched root file '${firstSegment}' sits outside the allowed root-file set for this module`
        : `new root file '${firstSegment}' is outside the allowed root-file set; place it under a whitelisted subtree`,
      contractReason
    ));
    return findings;
  }

  if (contract.rootPolicy === "legacy-frozen" && !allowedRootFile) {
    findings.push(buildFinding(
      filePath,
      existedInComparisonRef ? "warn" : "error",
      existedInComparisonRef
        ? `touched legacy root file '${firstSegment}' in a frozen module root; future growth should happen inside whitelisted subtrees`
        : `new root file '${firstSegment}' is blocked because this module root is frozen; place it under a whitelisted subtree`,
      contractReason
    ));
  }

  return findings;
};

export const collectModuleStructureViolations = (changedFiles, options) => {
  const comparisonRef = options.baseRef ?? "HEAD";
  const pathExistsInRef = createPathExistsInRef();
  const violations = [];

  for (const filePath of changedFiles.map((entry) => normalizePath(entry))) {
    const contract = findModuleStructureContract(filePath);
    if (!contract) {
      continue;
    }

    const rootEntryPath = getModuleRootEntryPath(filePath, contract);
    violations.push(
      ...evaluateModuleStructureFindings({
        filePath,
        contract,
        existedInComparisonRef: pathExistsInRef(comparisonRef, filePath),
        rootEntryExistedInComparisonRef: rootEntryPath
          ? pathExistsInRef(comparisonRef, rootEntryPath)
          : false
      })
    );
  }

  return defaultSortByLocation(violations, "ownerLine");
};

export const runModuleStructureCheck = (options) => {
  const { changedFiles } = collectChangedWorkspaceFiles(options);
  if (changedFiles.length === 0) {
    return { changedFiles, violations: [] };
  }

  return {
    changedFiles,
    violations: collectModuleStructureViolations(changedFiles, options)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  const blockingFindings = violations.filter((item) => item.level === "error");
  const warningFindings = violations.filter((item) => item.level !== "error");

  if (blockingFindings.length === 0 && warningFindings.length === 0) {
    console.log(`Module-structure diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  if (warningFindings.length > 0) {
    console.warn("Module-structure diff check found touched legacy drift that still needs cleanup.");
    for (const warning of warningFindings) {
      console.warn(`- [${warning.level}] ${warning.filePath}: ${warning.message}`);
      if (warning.reason) {
        console.warn(`  reason: ${warning.reason}`);
      }
    }
  }

  if (blockingFindings.length === 0) {
    return 0;
  }

  console.error("Module-structure diff check blocked new hierarchy drift that violates a module contract.");
  for (const violation of blockingFindings) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    if (violation.reason) {
      console.error(`  reason: ${violation.reason}`);
    }
  }
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runModuleStructureCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
