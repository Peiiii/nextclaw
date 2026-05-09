#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";

import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs,
  rootDir,
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-package-public-imports.mjs
  node scripts/governance/lint-new-code-package-public-imports.mjs --staged
  node scripts/governance/lint-new-code-package-public-imports.mjs --base origin/main
  node scripts/governance/lint-new-code-package-public-imports.mjs -- packages/nextclaw/src

Blocks cross-workspace package deep imports. A workspace may import another workspace package only through its package root public entry.`;

const workspaceRootNames = ["apps", "packages", "workers"];
const codeFilePattern = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

const normalizePath = (value) => value.split(path.sep).join("/");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const collectWorkspacePackages = () => {
  const packages = [];

  const visit = (absoluteDir) => {
    const packageJsonPath = path.join(absoluteDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = readJson(packageJsonPath);
      if (typeof packageJson.name === "string" && packageJson.name.trim()) {
        packages.push({
          name: packageJson.name,
          rootPath: normalizePath(path.relative(rootDir, absoluteDir)),
        });
      }
      return;
    }

    if (!fs.existsSync(absoluteDir)) {
      return;
    }
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      visit(path.join(absoluteDir, entry.name));
    }
  };

  for (const rootName of workspaceRootNames) {
    visit(path.join(rootDir, rootName));
  }

  return packages.sort((left, right) => right.rootPath.length - left.rootPath.length);
};

const parseBarePackageSpecifier = (specifier) => {
  if (typeof specifier !== "string" || specifier.startsWith(".") || specifier.startsWith("node:")) {
    return null;
  }
  return specifier;
};

const resolveWorkspaceImport = (specifier, workspacePackages) => {
  const bareSpecifier = parseBarePackageSpecifier(specifier);
  if (!bareSpecifier) {
    return null;
  }
  for (const workspacePackage of workspacePackages) {
    if (bareSpecifier === workspacePackage.name) {
      return {
        packageName: workspacePackage.name,
        subpath: "",
        targetPackage: workspacePackage,
      };
    }
    if (bareSpecifier.startsWith(`${workspacePackage.name}/`)) {
      return {
        packageName: workspacePackage.name,
        subpath: bareSpecifier.slice(workspacePackage.name.length + 1),
        targetPackage: workspacePackage,
      };
    }
  }
  return null;
};

const findOwningPackage = (filePath, workspacePackages) => {
  const normalizedFilePath = normalizePath(filePath);
  return workspacePackages.find((workspacePackage) => (
    normalizedFilePath === workspacePackage.rootPath ||
    normalizedFilePath.startsWith(`${workspacePackage.rootPath}/`)
  )) ?? null;
};

const collectImportSpecifiers = (source, filePath) => {
  const ast = parser.parse(source, {
    sourceType: "module",
    ecmaVersion: "latest",
    ecmaFeatures: {
      jsx: filePath.endsWith(".tsx") || filePath.endsWith(".jsx"),
    },
    loc: true,
  });

  const specifiers = [];
  for (const statement of ast.body) {
    if (
      (statement.type === "ImportDeclaration" ||
        statement.type === "ExportNamedDeclaration" ||
        statement.type === "ExportAllDeclaration") &&
      statement.source &&
      typeof statement.source.value === "string"
    ) {
      specifiers.push({
        value: statement.source.value,
        line: statement.source.loc.start.line,
        column: statement.source.loc.start.column + 1,
      });
    }
  }
  return specifiers;
};

export const collectPackagePublicImportViolations = (filePaths, workspacePackages = collectWorkspacePackages()) => {
  const findings = [];

  for (const filePath of filePaths) {
    if (!codeFilePattern.test(filePath)) {
      continue;
    }
    const importerPackage = findOwningPackage(filePath, workspacePackages);
    if (!importerPackage) {
      continue;
    }
    const source = fs.readFileSync(path.resolve(rootDir, filePath), "utf8");
    for (const specifier of collectImportSpecifiers(source, filePath)) {
      const resolvedImport = resolveWorkspaceImport(specifier.value, workspacePackages);
      if (!resolvedImport?.subpath) {
        continue;
      }
      if (resolvedImport.targetPackage.rootPath === importerPackage.rootPath) {
        continue;
      }
      findings.push({
        filePath,
        line: specifier.line,
        column: specifier.column,
        level: "error",
        message: `cross-workspace package imports must use '${resolvedImport.packageName}' public root instead of deep importing '${specifier.value}'`,
      });
    }
  }

  return defaultSortByLocation(findings);
};

export const runPackagePublicImportCheck = (options) => {
  const { changedFiles } = collectChangedWorkspaceFiles(options);
  return {
    changedFiles,
    findings: collectPackagePublicImportViolations(changedFiles),
  };
};

const printFindings = (findings) => {
  for (const finding of findings) {
    console.error(`${finding.filePath}:${finding.line}:${finding.column} ${finding.level} ${finding.message}`);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  const result = runPackagePublicImportCheck(options);
  if (result.changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    process.exit(0);
  }
  if (result.findings.length === 0) {
    console.log(`Package public import check passed for ${result.changedFiles.length} changed file(s).`);
    process.exit(0);
  }
  printFindings(result.findings);
  console.error("Package public import check failed.");
  process.exit(1);
}
