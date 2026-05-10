#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";

import {
  defaultSortByLocation,
  parseDiffCheckArgs,
  rootDir,
  walkAst
} from "./lint-new-code-governance-support.mjs";
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
  "constants",
  "controller",
  "manager",
  "presenter",
  "provider",
  "repository",
  "route",
  "service",
  "store",
  "test",
  "types",
  "utils"
]);

const roleRule = (role, expectedLabel = `*.${role}.ts`) => ({
  type: "role-suffix",
  role,
  expectedLabel
});

const DIRECTORY_ROLE_RULES = {
  controllers: roleRule("controller"),
  managers: roleRule("manager"),
  presenters: roleRule("presenter", "*.presenter.ts(x)"),
  configs: roleRule("config", "*.config.ts(x)"),
  providers: roleRule("provider", "*.provider.ts(x)"),
  repositories: roleRule("repository"),
  routes: roleRule("route", "*.route.ts(x)"),
  services: roleRule("service"),
  stores: roleRule("store"),
  types: roleRule("types"),
  utils: roleRule("utils"),
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
const ELECTRON_ROOT_ENTRY_STEM_ALLOWLIST = new Set(["main", "preload", "launcher"]);
const WEB_STANDARD_PUBLIC_FILES = new Set(["manifest.webmanifest", "sw.js"]);
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
  [".agents/", "bridge/", "apps/docs/.vitepress/data/"].some((prefix) => normalizedPath.startsWith(prefix)) || segments.includes("scripts")
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

const isServiceImplementationFile = (stem) => stem.endsWith(".service");

const readEntrySource = (normalizedPath, options) => {
  if (options.sourceByFilePath?.has(normalizedPath)) {
    return options.sourceByFilePath.get(normalizedPath);
  }
  return readFileSync(path.resolve(rootDir, normalizedPath), "utf8");
};

const hasClassDeclaration = (source, filePath) => {
  const ast = parser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: filePath.endsWith(".tsx")
    }
  });
  let hasClass = false;
  walkAst(ast, (node) => {
    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      hasClass = true;
    }
  });
  return hasClass;
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

const isElectronRootEntryStem = (segments, stem) => {
  if (!ELECTRON_ROOT_ENTRY_STEM_ALLOWLIST.has(stem) || segments.length === 0) {
    return false;
  }
  return segments.at(-1) === "electron";
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
  isLegacyRootEntryStem(segments, stem) ||
  isElectronRootEntryStem(segments, stem) ||
  isContractAllowedRootFile(normalizedPath, contract)
);

const isDefaultRoleSuffixExempt = (normalizedPath, segments, stem, nearestRule, contract) => {
  if (EXACT_ALLOWLIST_ANYWHERE.has(stem)) {
    return true;
  }
  if (nearestRule?.segment === "components" || nearestRule?.segment === "pages" || nearestRule?.segment === "hooks") {
    return true;
  }
  if (segments.at(-1) === "public" && WEB_STANDARD_PUBLIC_FILES.has(path.posix.basename(normalizedPath))) {
    return true;
  }
  return isRootEntryFile(normalizedPath, segments, stem, contract) || nearestRule?.segment === "app";
};

const buildViolation = (entry, message, ruleId) => ({
  filePath: entry.filePath,
  line: 1,
  column: 1,
  ownerLine: 1,
  status: entry.status,
  level: "error",
  ruleId,
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

const buildServiceClassMessage = (entry) => (
  isTrackedAsNewOrRename(entry.status)
    ? "new or renamed .service.ts file must declare an internal class; use .utils.ts or another role suffix for classless modules"
    : "touched .service.ts file must declare an internal class; rename it to .utils.ts or another role suffix if it is classless"
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

  if (isServiceImplementationFile(stem) && !hasClassDeclaration(readEntrySource(normalizedPath, options), normalizedPath)) {
    return buildViolation(entry, buildServiceClassMessage(entry), "service-requires-class");
  }

  if (nearestRule) {
    const { segment, rule } = nearestRule;
    if (rule.type === "role-suffix" && !isRoleDirectoryMatch(stem, rule.role)) {
      return buildViolation(entry, buildDirectoryMismatchMessage(entry, segment, rule.expectedLabel), `directory:${segment}:${rule.expectedLabel}`);
    }
    if (rule.type === "hook" && !isHookFileName(stem)) {
      return buildViolation(entry, buildDirectoryMismatchMessage(entry, segment, rule.expectedLabel), `directory:${segment}:${rule.expectedLabel}`);
    }
    if (rule.type === "page" && !isPageFileName(stem)) {
      return buildViolation(entry, buildDirectoryMismatchMessage(entry, segment, rule.expectedLabel), `directory:${segment}:${rule.expectedLabel}`);
    }
  }

  if (isDefaultRoleSuffixExempt(normalizedPath, segments, stem, nearestRule, moduleContract)) {
    return null;
  }

  if (hasAllowedRoleSuffix(stem)) {
    return null;
  }

  return buildViolation(entry, buildDefaultSuffixMessage(entry), "default-role-suffix");
};

const preservesExistingRenameViolation = (entry, violation) => {
  if (entry.status !== "R" || !entry.oldFilePath) {
    return false;
  }

  const previousViolation = inspectFileRoleBoundaryEntry({
    filePath: entry.oldFilePath,
    status: "M"
  });

  return previousViolation?.ruleId === violation.ruleId;
};

export const collectFileRoleBoundaryViolations = (entries) => defaultSortByLocation(
  entries
    .map(inspectFileRoleBoundaryEntry)
    .filter((violation, index) => violation && !preservesExistingRenameViolation(entries[index], violation))
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

  if (errors.length === 0) {
    console.log(`File role-boundary diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("File role-boundary diff check blocked changed files whose directory and suffix naming do not match.");
  for (const violation of errors) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
  }

  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFileRoleBoundaryCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
