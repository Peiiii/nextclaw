#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { collectDirectoryBudgetHotspots } from "./maintainability-directory-budget.mjs";
import {
  findDeferredMaintainabilityWorkspace,
  MAINTAINABILITY_REPORT_DEFERRED_WORKSPACES
} from "./maintainability-report-scope.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackedRuleIds = new Set([
  "max-lines",
  "max-lines-per-function",
  "max-statements",
  "max-depth",
  "sonarjs/cognitive-complexity"
]);

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const options = {
  json: args.includes("--json"),
  failOnViolations: args.includes("--fail-on-violations"),
  failOnCoverageGaps: args.includes("--fail-on-coverage-gaps")
};

const toPosixPath = (input) => input.split(sep).join("/");

const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const codeFileExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".py", ".sh"]);
const ignoredCoverageDirs = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".vite",
  ".vitepress",
  ".wrangler",
  ".git",
  "coverage",
  "public",
  "ui-dist",
  "release",
  "out",
  "tmp"
]);
const repoLevelMaintainabilityRoots = ["scripts", "bridge"];

const listWorkspacePackageDirs = () => {
  const rootPackage = readJsonFile(resolve(rootDir, "package.json"));
  const workspacePatterns = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  const packageDirs = new Set();

  for (const pattern of workspacePatterns) {
    if (!pattern.includes("*")) {
      const packageDir = resolve(rootDir, pattern);
      if (existsSync(resolve(packageDir, "package.json"))) {
        packageDirs.add(packageDir);
      }
      continue;
    }

    const wildcardIndex = pattern.indexOf("*");
    const basePattern = pattern.slice(0, wildcardIndex).replace(/\/$/, "");
    const baseDir = resolve(rootDir, basePattern);
    if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) {
      continue;
    }

    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageDir = resolve(baseDir, entry.name);
      if (existsSync(resolve(packageDir, "package.json"))) {
        packageDirs.add(packageDir);
      }
    }
  }

  return Array.from(packageDirs).sort((left, right) => left.localeCompare(right));
};

const hasEslintLintScript = (packageDir) => {
  const packageJson = readJsonFile(resolve(packageDir, "package.json"));
  const lintScript = packageJson.scripts?.lint;
  return typeof lintScript === "string" && lintScript.includes("eslint");
};

const hasCodeFiles = (packageDir) => {
  const pendingDirs = [packageDir];

  while (pendingDirs.length > 0) {
    const currentDir = pendingDirs.pop();
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (ignoredCoverageDirs.has(entry.name)) {
        continue;
      }
      const fullPath = resolve(currentDir, entry.name);
      if (entry.isDirectory()) {
        pendingDirs.push(fullPath);
        continue;
      }
      if (codeFileExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        return true;
      }
    }
  }

  return false;
};

const collapseNestedTargets = (packageDirs) => {
  const sortedDirs = [...packageDirs].sort((left, right) => left.length - right.length || left.localeCompare(right));
  const collapsed = [];

  for (const packageDir of sortedDirs) {
    if (collapsed.some((parentDir) => packageDir.startsWith(`${parentDir}${sep}`))) {
      continue;
    }
    collapsed.push(packageDir);
  }

  return collapsed;
};

const workspacePackages = listWorkspacePackageDirs().map((packageDir) => ({
  packageDir,
  workspace: toPosixPath(relative(rootDir, packageDir)),
  hasCodeFiles: hasCodeFiles(packageDir),
  hasEslintLintScript: hasEslintLintScript(packageDir)
}));
const activeWorkspacePackages = workspacePackages.filter((entry) => !findDeferredMaintainabilityWorkspace(entry.workspace));

const nonCodeWorkspaces = workspacePackages
  .filter((entry) => !entry.hasCodeFiles)
  .map((entry) => entry.workspace);
const uncoveredCodeWorkspaces = activeWorkspacePackages
  .filter((entry) => entry.hasCodeFiles && !entry.hasEslintLintScript)
  .map((entry) => entry.workspace);

const detectedPackageDirs = activeWorkspacePackages
  .filter((entry) => entry.hasCodeFiles && entry.hasEslintLintScript)
  .map((entry) => entry.packageDir);
const targetPackageDirs = collapseNestedTargets(detectedPackageDirs);
const directoryBudgetTargetDirs = collapseNestedTargets([
  ...activeWorkspacePackages
    .filter((entry) => entry.hasCodeFiles)
    .map((entry) => entry.packageDir),
  ...repoLevelMaintainabilityRoots
    .map((relativeDir) => resolve(rootDir, relativeDir))
    .filter((absoluteDir) => existsSync(absoluteDir) && statSync(absoluteDir).isDirectory() && hasCodeFiles(absoluteDir))
]);
const deferredWorkspaces = MAINTAINABILITY_REPORT_DEFERRED_WORKSPACES
  .map((entry) => ({
    workspace: entry.workspace,
    reason: entry.reason,
    hasCodeFiles: workspacePackages.some((workspaceEntry) => workspaceEntry.workspace === entry.workspace && workspaceEntry.hasCodeFiles),
    hasEslintLintScript: workspacePackages.some((workspaceEntry) => workspaceEntry.workspace === entry.workspace && workspaceEntry.hasEslintLintScript)
  }))
  .filter((entry) => entry.hasCodeFiles);

const detectWorkspace = (absoluteFilePath) => {
  const matchedDir = targetPackageDirs
    .filter((packageDir) => absoluteFilePath === packageDir || absoluteFilePath.startsWith(`${packageDir}${sep}`))
    .sort((left, right) => right.length - left.length)[0];

  if (!matchedDir) {
    return "root";
  }

  return toPosixPath(relative(rootDir, matchedDir));
};

const eslint = new ESLint({
  cwd: rootDir,
  errorOnUnmatchedPattern: false
});

const lintTargets = targetPackageDirs.map((packageDir) => toPosixPath(relative(rootDir, packageDir)));
const results = await eslint.lintFiles(lintTargets);
const directoryBudget = collectDirectoryBudgetHotspots({
  rootDir,
  scanRoots: directoryBudgetTargetDirs.map((targetDir) => toPosixPath(relative(rootDir, targetDir)))
});

const violations = [];
const nonTargetErrors = [];

for (const result of results) {
  const relativeFilePath = toPosixPath(relative(rootDir, result.filePath));
  const workspace = detectWorkspace(result.filePath);
  for (const message of result.messages) {
    if (trackedRuleIds.has(message.ruleId ?? "")) {
      violations.push({
        workspace,
        filePath: relativeFilePath,
        ruleId: message.ruleId,
        severity: message.severity,
        line: message.line ?? 0,
        column: message.column ?? 0,
        message: message.message
      });
      continue;
    }

    if (message.severity === 2 || message.fatal) {
      nonTargetErrors.push({
        workspace,
        filePath: relativeFilePath,
        ruleId: message.ruleId ?? "fatal",
        line: message.line ?? 0,
        column: message.column ?? 0,
        message: message.message
      });
    }
  }
}

violations.sort((left, right) => {
  if (left.workspace !== right.workspace) {
    return left.workspace.localeCompare(right.workspace);
  }
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  if (left.ruleId !== right.ruleId) {
    return left.ruleId.localeCompare(right.ruleId);
  }
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.column - right.column;
});

nonTargetErrors.sort((left, right) => {
  if (left.workspace !== right.workspace) {
    return left.workspace.localeCompare(right.workspace);
  }
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.column - right.column;
});

const violationsByRule = Object.fromEntries(
  [...trackedRuleIds]
    .sort((left, right) => left.localeCompare(right))
    .map((ruleId) => [ruleId, violations.filter((violation) => violation.ruleId === ruleId).length])
);

const violationsByWorkspace = Array.from(
  violations.reduce((map, violation) => {
    const current = map.get(violation.workspace) ?? [];
    current.push(violation);
    map.set(violation.workspace, current);
    return map;
  }, new Map())
)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([workspace, workspaceViolations]) => ({
    workspace,
    count: workspaceViolations.length,
    files: Array.from(
      workspaceViolations.reduce((map, violation) => {
        const current = map.get(violation.filePath) ?? [];
        current.push(violation);
        map.set(violation.filePath, current);
        return map;
      }, new Map())
    )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([filePath, fileViolations]) => ({
        filePath,
        count: fileViolations.length,
        violations: fileViolations
      }))
  }));

const report = {
  scannedWorkspaces: targetPackageDirs.map((packageDir) => toPosixPath(relative(rootDir, packageDir))),
  deferredWorkspaces,
  coverage: {
    totalWorkspaces: workspacePackages.length,
    codeWorkspaces: workspacePackages.filter((entry) => entry.hasCodeFiles).map((entry) => entry.workspace),
    activeCodeWorkspaces: activeWorkspacePackages.filter((entry) => entry.hasCodeFiles).map((entry) => entry.workspace),
    deferredCodeWorkspaces: deferredWorkspaces.map((entry) => entry.workspace),
    nonCodeWorkspaces,
    uncoveredCodeWorkspaces
  },
  totalViolations: violations.length,
  affectedFiles: new Set(violations.map((violation) => violation.filePath)).size,
  violationsByRule,
  violationsByWorkspace,
  directoryBudget,
  ignoredNonTargetErrors: nonTargetErrors
};

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Workspace maintainability report");
  console.log(`Scanned workspaces: ${report.scannedWorkspaces.length}`);
  console.log(`Deferred workspaces: ${report.deferredWorkspaces.length}`);
  console.log(`Code workspaces: ${report.coverage.activeCodeWorkspaces.length} active / ${report.coverage.codeWorkspaces.length} total`);
  console.log(`Non-code workspaces: ${report.coverage.nonCodeWorkspaces.length}`);
  console.log(`Coverage gaps: ${report.coverage.uncoveredCodeWorkspaces.length}`);
  console.log(`Affected files: ${report.affectedFiles}`);
  console.log(`Total violations: ${report.totalViolations}`);
  console.log(
    `Directory hotspots: ${report.directoryBudget.totalHotspots} (error=${report.directoryBudget.countsByLevel.error}, warn=${report.directoryBudget.countsByLevel.warn})`
  );
  for (const [ruleId, count] of Object.entries(report.violationsByRule)) {
    console.log(`- ${ruleId}: ${count}`);
  }

  if (report.deferredWorkspaces.length > 0) {
    console.log("");
    console.log("Deferred maintainability workspaces:");
    for (const entry of report.deferredWorkspaces) {
      console.log(`- ${entry.workspace}: ${entry.reason}`);
    }
  }

  if (report.coverage.uncoveredCodeWorkspaces.length > 0) {
    console.log("");
    console.log("Uncovered code workspaces:");
    for (const workspace of report.coverage.uncoveredCodeWorkspaces) {
      console.log(`- ${workspace}`);
    }
  }

  if (report.totalViolations === 0) {
    console.log("");
    console.log("No tracked maintainability violations found.");
  } else {
    for (const workspaceEntry of report.violationsByWorkspace) {
      console.log("");
      console.log(`[${workspaceEntry.workspace}] ${workspaceEntry.count}`);
      for (const fileEntry of workspaceEntry.files) {
        console.log(`  ${fileEntry.filePath} (${fileEntry.count})`);
        for (const violation of fileEntry.violations) {
          console.log(
            `    - ${violation.ruleId} ${violation.line}:${violation.column} ${violation.message}`
          );
        }
      }
    }
  }

  console.log("");
  console.log("Directory budget hotspots:");
  console.log(
    `Scanned roots: ${report.directoryBudget.scannedRoots.length}, scanned directories: ${report.directoryBudget.scannedDirectories}`
  );
  if (report.directoryBudget.totalHotspots === 0) {
    console.log("- No directory budget hotspots found.");
  } else {
    for (const hotspot of report.directoryBudget.hotspots) {
      const exceptionSummary = hotspot.exception_status === "complete"
        ? `complete (${hotspot.exception_path})`
        : hotspot.exception_status === "incomplete"
          ? `incomplete (${hotspot.exception_path})`
          : "missing";
      console.log(
        `- [${hotspot.level}] ${hotspot.path} direct_files=${hotspot.current_count} budget=${hotspot.budget} exception=${exceptionSummary}`
      );
      console.log(`  ${hotspot.message}`);
      if (hotspot.exception_reason) {
        console.log(`  exception_reason=${hotspot.exception_reason}`);
      }
    }
  }

  if (report.ignoredNonTargetErrors.length > 0) {
    console.log("");
    console.log(`Ignored non-target ESLint errors: ${report.ignoredNonTargetErrors.length}`);
    for (const issue of report.ignoredNonTargetErrors.slice(0, 20)) {
      console.log(`- ${issue.filePath}:${issue.line}:${issue.column} [${issue.ruleId}] ${issue.message}`);
    }
    if (report.ignoredNonTargetErrors.length > 20) {
      console.log(`- ... ${report.ignoredNonTargetErrors.length - 20} more`);
    }
  }
}

if (options.failOnViolations && (report.totalViolations > 0 || report.directoryBudget.countsByLevel.error > 0)) {
  process.exit(1);
}
if (options.failOnCoverageGaps && report.coverage.uncoveredCodeWorkspaces.length > 0) {
  process.exit(1);
}
