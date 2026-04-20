#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultSortByLocation, parseDiffCheckArgs } from "./lint-new-code-governance-support.mjs";
import { collectChangedFileNameEntries } from "./lint-new-code-file-names.mjs";
import {
  findModuleStructureContract,
  toModuleRelativePath
} from "./module-structure/module-structure-contracts.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-file-role-boundaries.mjs
  node scripts/governance/lint-new-code-file-role-boundaries.mjs --staged
  node scripts/governance/lint-new-code-file-role-boundaries.mjs --base origin/main
  node scripts/governance/lint-new-code-file-role-boundaries.mjs -- packages/nextclaw-ui/src

Blocks changed workspace source files whose file names violate the repository's
directory-to-suffix mapping or the default role-suffix whitelist.
Once a file is touched, legacy role-boundary debt must be fixed in the same change.`;

const ROLE_SUFFIX_ALLOWLIST = new Set([
  "config",
  "controller",
  "manager",
  "provider",
  "repository",
  "service",
  "store",
  "test",
  "types",
  "utils"
]);

const DIRECTORY_ROLE_RULES = {
  controllers: {
    type: "role-suffix",
    role: "controller",
    expectedLabel: "*.controller.ts"
  },
  configs: {
    type: "role-suffix",
    role: "config",
    expectedLabel: "*.config.ts(x)"
  },
  providers: {
    type: "role-suffix",
    role: "provider",
    expectedLabel: "*.provider.ts(x)"
  },
  repositories: {
    type: "role-suffix",
    role: "repository",
    expectedLabel: "*.repository.ts"
  },
  services: {
    type: "role-suffix",
    role: "service",
    expectedLabel: "*.service.ts"
  },
  stores: {
    type: "role-suffix",
    role: "store",
    expectedLabel: "*.store.ts"
  },
  types: {
    type: "role-suffix",
    role: "types",
    expectedLabel: "*.types.ts"
  },
  utils: {
    type: "role-suffix",
    role: "utils",
    expectedLabel: "*.utils.ts"
  },
  hooks: {
    type: "hook",
    expectedLabel: "use-<domain>.ts(x)"
  },
  pages: {
    type: "page",
    expectedLabel: "<domain>-page.ts(x)"
  },
  components: {
    type: "component"
  },
  app: {
    type: "app-entry"
  }
};

const EXACT_ALLOWLIST_ANYWHERE = new Set(["index", "sitecustomize"]);
const ROOT_ENTRY_STEM_ALLOWLIST = new Set(["app", "main"]);
const TEST_QUALIFIER_PATTERN = "[a-z0-9-]+";
const SOURCE_ROOT_SEGMENTS = new Set(["src"]);

const toPosixPath = (filePath) => filePath.split(path.sep).join(path.posix.sep);

const isTrackedAsNewOrRename = (status) => status === "A" || status === "R" || status === "U";

const getExtension = (filePath) => path.posix.extname(filePath);

const getStem = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const extension = getExtension(normalizedPath);
  return path.posix.basename(normalizedPath, extension);
};

const getDirectorySegments = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const directoryPath = path.posix.dirname(normalizedPath);
  if (!directoryPath || directoryPath === ".") {
    return [];
  }
  return directoryPath.split("/").filter(Boolean);
};

const shouldSkipRoleBoundaryCheck = (normalizedPath, segments) => (
  normalizedPath.startsWith(".agents/") ||
  normalizedPath.startsWith("bridge/") ||
  segments.includes("scripts")
);

const getNearestDirectoryRule = (segments) => {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const rule = DIRECTORY_ROLE_RULES[segment];
    if (rule) {
      return {
        segment,
        segmentIndex: index,
        rule
      };
    }
  }
  return null;
};

const hasAllowedRoleSuffix = (stem) => {
  const segments = stem.split(".");
  const lastSegment = segments.at(-1);
  return ROLE_SUFFIX_ALLOWLIST.has(lastSegment);
};

const isRoleDirectoryMatch = (stem, role) => {
  const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\.${escapedRole}(?:\\.${TEST_QUALIFIER_PATTERN})*\\.test$|\\.${escapedRole}$`);
  return pattern.test(stem);
};

const isHookFileName = (stem) => {
  if (stem === "index") {
    return true;
  }
  return /^use-[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9-]+)*(\.test)?$/.test(stem);
};

const isPageFileName = (stem) => {
  if (stem === "index") {
    return true;
  }
  return /-page(?:\.[a-z0-9-]+)*(\.test)?$/.test(stem);
};

const isLegacyRootEntryStem = (segments, stem) => {
  if (!ROOT_ENTRY_STEM_ALLOWLIST.has(stem) || segments.length === 0) {
    return false;
  }

  const lastSrcIndex = segments.reduce((result, segment, index) => (
    SOURCE_ROOT_SEGMENTS.has(segment) ? index : result
  ), -1);

  return lastSrcIndex >= 0 && lastSrcIndex === segments.length - 1;
};

const isContractAllowedRootFile = (normalizedPath, contract) => {
  if (!contract) {
    return false;
  }

  const moduleRelativePath = toModuleRelativePath(normalizedPath, contract);
  if (!moduleRelativePath || moduleRelativePath.includes("/")) {
    return false;
  }

  return contract.allowedRootFiles?.has(moduleRelativePath) ?? false;
};

const isRootEntryFile = (normalizedPath, segments, stem, contract) => (
  isLegacyRootEntryStem(segments, stem) || isContractAllowedRootFile(normalizedPath, contract)
);

const isDefaultRoleSuffixExempt = (normalizedPath, segments, stem, nearestRule, contract) => {
  if (EXACT_ALLOWLIST_ANYWHERE.has(stem)) {
    return true;
  }
  if (nearestRule?.segment === "components" || nearestRule?.segment === "pages" || nearestRule?.segment === "hooks") {
    return true;
  }
  return isRootEntryFile(normalizedPath, segments, stem, contract) || nearestRule?.segment === "app";
};

const buildViolation = (entry, message) => ({
  filePath: entry.filePath,
  line: 1,
  column: 1,
  ownerLine: 1,
  status: entry.status,
  level: "error",
  message
});

const buildDirectoryMismatchMessage = (entry, directoryName, expectedLabel) => (
  isTrackedAsNewOrRename(entry.status)
    ? `new or renamed file in '${directoryName}/' must match '${expectedLabel}' (tests may append '*.test.ts'); rename the file or move it to the correct directory`
    : `touched file in '${directoryName}/' does not match '${expectedLabel}' (tests may append '*.test.ts'); rename or relocate it before continuing`
);

const buildDefaultSuffixMessage = (entry) => (
  isTrackedAsNewOrRename(entry.status)
    ? "new or renamed non-component/page/hook file must use an approved secondary suffix or an allowed app/root entry name"
    : "touched non-component/page/hook file lacks an approved secondary suffix or allowed app/root entry name; rename it before continuing"
);

export const inspectFileRoleBoundaryEntry = (entry, options = {}) => {
  const normalizedPath = toPosixPath(entry.filePath);
  const segments = getDirectorySegments(normalizedPath);
  if (shouldSkipRoleBoundaryCheck(normalizedPath, segments)) {
    return null;
  }

  const stem = getStem(normalizedPath);
  const nearestRule = getNearestDirectoryRule(segments);
  const moduleContract = options.moduleContract ?? findModuleStructureContract(normalizedPath);

  if (nearestRule) {
    const { segment, rule } = nearestRule;
    if (rule.type === "role-suffix" && !isRoleDirectoryMatch(stem, rule.role)) {
      return buildViolation(entry, buildDirectoryMismatchMessage(entry, segment, rule.expectedLabel));
    }
    if (rule.type === "hook" && !isHookFileName(stem)) {
      return buildViolation(entry, buildDirectoryMismatchMessage(entry, segment, rule.expectedLabel));
    }
    if (rule.type === "page" && !isPageFileName(stem)) {
      return buildViolation(entry, buildDirectoryMismatchMessage(entry, segment, rule.expectedLabel));
    }
  }

  if (isDefaultRoleSuffixExempt(normalizedPath, segments, stem, nearestRule, moduleContract)) {
    return null;
  }

  if (hasAllowedRoleSuffix(stem)) {
    return null;
  }

  return buildViolation(entry, buildDefaultSuffixMessage(entry));
};

export const collectFileRoleBoundaryViolations = (entries) => defaultSortByLocation(
  entries
    .map(inspectFileRoleBoundaryEntry)
    .filter(Boolean)
);

export const runFileRoleBoundaryCheck = (options) => {
  const { changedFiles, entries } = collectChangedFileNameEntries(options);
  const governedEntries = entries.filter((entry) => {
    const normalizedPath = toPosixPath(entry.filePath);
    const segments = getDirectorySegments(normalizedPath);
    return !shouldSkipRoleBoundaryCheck(normalizedPath, segments);
  });

  return {
    changedFiles: changedFiles.filter((filePath) => {
      const normalizedPath = toPosixPath(filePath);
      const segments = getDirectorySegments(normalizedPath);
      return !shouldSkipRoleBoundaryCheck(normalizedPath, segments);
    }),
    violations: collectFileRoleBoundaryViolations(governedEntries)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  const errors = violations.filter((item) => item.level === "error");
  const warnings = violations.filter((item) => item.level === "warn");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`File role-boundary diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  if (errors.length > 0) {
    console.error("File role-boundary diff check blocked changed files whose directory and suffix naming do not match.");
    for (const violation of errors) {
      console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    }
  }

  if (warnings.length > 0) {
    const writer = errors.length > 0 ? console.error : console.log;
    writer("Legacy file role-boundary warnings:");
    for (const violation of warnings) {
      writer(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    }
  }

  return errors.length > 0 ? 1 : 0;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFileRoleBoundaryCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
