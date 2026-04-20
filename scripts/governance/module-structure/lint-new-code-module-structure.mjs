#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectAddedLinesByFile,
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs,
  rootDir,
  runGit
} from "../lint-new-code-governance-support.mjs";
import {
  findModuleStructureContract,
  getModuleRootEntryPath,
  isProtocolContract,
  normalizePath,
  SHARED_CONTAINER_DIRECTORY_NAMES,
  splitModuleRelativePath,
  toModuleRelativePath
} from "./module-structure-contracts.mjs";
import {
  evaluateProtocolImportBoundaryFindings,
  evaluateProtocolStructureFindings
} from "./module-structure-protocol-checks.mjs";

const usage = `Usage:
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs --staged
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs --base origin/main
  node scripts/governance/module-structure/lint-new-code-module-structure.mjs -- packages/nextclaw-ui/src

Checks touched files against explicit module-structure contracts so crowded roots do not keep growing without subtree boundaries.
Protocol-enabled modules also validate structure and import boundaries against fixed hierarchy templates.`;

const SHARED_DIRECTORY_ROLE_HINT = /(service|manager|controller|presenter|provider|orchestrator|runtime|router|route|store|gateway|handler|policy|registry)\b/;
const GOVERNED_IMPORT_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

const buildFinding = (filePath, level, message, reason, line = 1, column = 1) => ({
  filePath,
  line,
  column,
  ownerLine: line,
  level,
  message,
  reason
});

const isGovernedImportFile = (filePath) => GOVERNED_IMPORT_FILE_EXTENSIONS.has(path.posix.extname(filePath));
const getDriftLevel = (contract, existedInComparisonRef) => (
  contract.rootPolicy === "contract-only"
    ? "error"
    : existedInComparisonRef ? "warn" : "error"
);

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

const evaluateStructureEntryFindings = ({
  filePath,
  contract,
  existedInComparisonRef,
  rootEntryExistedInComparisonRef
}) => {
  const relativePath = toModuleRelativePath(filePath, contract);
  const segments = splitModuleRelativePath(filePath, contract);
  if (!relativePath || segments.length === 0) {
    return [];
  }

  const firstSegment = segments[0];
  const isRootFile = segments.length === 1;
  const findings = [];
  const contractReason = isProtocolContract(contract)
    ? `protocol=${contract.protocol} module=${contract.modulePath}`
    : `contract=${contract.modulePath} model=${contract.organizationModel}`;

  if (!isRootFile) {
    if (!contract.allowedRootDirectories.has(firstSegment)) {
      const level = getDriftLevel(contract, existedInComparisonRef);
      if (level !== "error") {
        findings.push(buildFinding(
          filePath,
          level,
          `touched file still lives under legacy root directory '${firstSegment}/' outside the module structure whitelist`,
          contractReason
        ));
        return findings;
      }

      findings.push(buildFinding(
        filePath,
        "error",
        rootEntryExistedInComparisonRef
          ? `new file was added under legacy root directory '${firstSegment}/', which is outside the module structure whitelist`
          : `new root directory '${firstSegment}/' is outside the module structure whitelist`,
        contractReason
      ));
      return findings;
    }

    if (!isProtocolContract(contract) && (contract.sharedDirectories.has(firstSegment) || SHARED_CONTAINER_DIRECTORY_NAMES.has(firstSegment))) {
      const basename = path.posix.basename(relativePath, path.posix.extname(relativePath)).toLowerCase();
      if (SHARED_DIRECTORY_ROLE_HINT.test(basename)) {
        const level = getDriftLevel(contract, existedInComparisonRef);
        findings.push(buildFinding(
          filePath,
          level,
          level === "warn"
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
    const level = getDriftLevel(contract, existedInComparisonRef);
    findings.push(buildFinding(
      filePath,
      level,
      level === "warn"
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

export const evaluateModuleStructureFindings = (params) => {
  const structureFindings = evaluateStructureEntryFindings(params);
  if (!isProtocolContract(params.contract)) {
    return structureFindings;
  }

  return [
    ...structureFindings,
    ...evaluateProtocolStructureFindings(params)
  ];
};

export { evaluateProtocolImportBoundaryFindings } from "./module-structure-protocol-checks.mjs";

export const collectModuleStructureViolations = (changedFiles, addedLinesByFile, options) => {
  const comparisonRef = options.baseRef ?? "HEAD";
  const pathExistsInRef = createPathExistsInRef();
  const violations = [];

  for (const filePath of changedFiles.map((entry) => normalizePath(entry))) {
    let contract;
    try {
      contract = findModuleStructureContract(filePath);
    } catch (error) {
      violations.push(buildFinding(
        filePath,
        "error",
        error instanceof Error ? error.message : String(error),
        "invalid-module-structure-config"
      ));
      continue;
    }
    if (!contract) {
      continue;
    }

    const rootEntryPath = getModuleRootEntryPath(filePath, contract);
    const existedInComparisonRef = pathExistsInRef(comparisonRef, filePath);

    violations.push(
      ...evaluateModuleStructureFindings({
        filePath,
        contract,
        existedInComparisonRef,
        rootEntryExistedInComparisonRef: rootEntryPath
          ? pathExistsInRef(comparisonRef, rootEntryPath)
          : false
      })
    );

    if (!isProtocolContract(contract) || !isGovernedImportFile(filePath)) {
      continue;
    }

    const absoluteFilePath = path.resolve(rootDir, filePath);
    if (!existsSync(absoluteFilePath)) {
      continue;
    }

    const source = readFileSync(absoluteFilePath, "utf8");
    violations.push(
      ...evaluateProtocolImportBoundaryFindings({
        filePath,
        source,
        addedLines: addedLinesByFile.get(filePath) ?? new Set(),
        contract
      })
    );
  }

  return defaultSortByLocation(violations, "ownerLine");
};

export const runModuleStructureCheck = (options) => {
  const { pathArgs, changedFiles, untrackedFiles } = collectChangedWorkspaceFiles(options);
  if (changedFiles.length === 0) {
    return { changedFiles, violations: [] };
  }

  const addedLinesByFile = collectAddedLinesByFile(pathArgs, untrackedFiles, options);
  return {
    changedFiles,
    violations: collectModuleStructureViolations(changedFiles, addedLinesByFile, options)
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
      console.warn(`- [${warning.level}] ${warning.filePath}:${warning.line}:${warning.column}: ${warning.message}`);
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
    console.error(`- [${violation.level}] ${violation.filePath}:${violation.line}:${violation.column}: ${violation.message}`);
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
