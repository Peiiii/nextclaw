#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";
import {
  collectAddedLinesByFile,
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  hasAddedLineInRange,
  parseDiffCheckArgs,
  rootDir,
  walkAst
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-object-methods.mjs
  node scripts/governance/lint-new-code-object-methods.mjs --staged
  node scripts/governance/lint-new-code-object-methods.mjs --base origin/main
  node scripts/governance/lint-new-code-object-methods.mjs -- packages/nextclaw/src

Checks every touched object literal in changed TypeScript workspace files.
Once an object literal is touched by the diff, all eligible object methods in that object must use foo: () => {}.
Ignored by design: getters/setters, constructors are not applicable here.`;

const getPropertyName = (node) => {
  const key = node.key;
  if (!key) {
    return "<unknown>";
  }
  if (key.type === "Identifier") {
    return key.name;
  }
  if (key.type === "Literal") {
    return String(key.value);
  }
  return "<computed>";
};

const isEligibleObjectMethod = (node) => node.type === "Property" && node.method && node.kind === "init" && Boolean(node.loc);

const getObjectLabel = (parent) => {
  if (!parent) {
    return "<object literal>";
  }
  if (parent.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }
  if (parent.type === "AssignmentExpression" && parent.left?.type === "Identifier") {
    return parent.left.name;
  }
  if (parent.type === "Property") {
    return `${getPropertyName(parent)} object`;
  }
  if (parent.type === "ReturnStatement") {
    return "<returned object>";
  }
  return "<object literal>";
};

export const collectViolationsForTouchedObjectLiterals = ({ filePath, source, addedLines }) => {
  if (!addedLines || addedLines.size === 0) {
    return [];
  }

  const ast = parser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    loc: true,
    range: false,
    ecmaFeatures: {
      jsx: filePath.endsWith(".tsx")
    }
  });

  const violations = [];
  walkAst(ast, (node, parent) => {
    if (node.type !== "ObjectExpression") {
      return;
    }
    if (!node.loc || !hasAddedLineInRange(addedLines, node.loc.start.line, node.loc.end.line)) {
      return;
    }

    const objectLabel = getObjectLabel(parent);
    for (const property of node.properties) {
      if (!isEligibleObjectMethod(property)) {
        continue;
      }
      violations.push({
        filePath,
        objectLabel,
        line: property.loc.start.line,
        column: property.loc.start.column + 1,
        propertyName: getPropertyName(property),
        objectStartLine: node.loc.start.line
      });
    }
  });

  return violations;
};

export const runObjectMethodArrowCheck = (options) => {
  const { pathArgs, changedFiles, untrackedFiles } = collectChangedWorkspaceFiles(options);
  if (changedFiles.length === 0) {
    return { changedFiles, violations: [] };
  }

  const addedLinesByFile = collectAddedLinesByFile(pathArgs, untrackedFiles, options);
  const violations = [];

  for (const filePath of changedFiles) {
    const addedLines = addedLinesByFile.get(filePath);
    if (!addedLines || addedLines.size === 0) {
      continue;
    }
    const source = readFileSync(resolve(rootDir, filePath), "utf8");
    violations.push(...collectViolationsForTouchedObjectLiterals({ filePath, source, addedLines }));
  }

  return {
    changedFiles,
    violations: defaultSortByLocation(violations, "objectStartLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Object arrow-property diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Object arrow-property diff check failed.");
  console.error("Use arrow-function object properties for touched-object methods: foo: () => {}");
  console.error("Once an object literal is touched, every eligible method in that object must use an arrow-function property.");
  console.error("Ignored by design: getters/setters.");
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line}:${violation.column} ${violation.objectLabel}.${violation.propertyName} should be an arrow-function object property`
    );
  }
  console.error(
    `Found ${violations.length} violation(s) across ${new Set(violations.map((item) => `${item.filePath}:${item.objectStartLine}`)).size} touched object literal(s).`
  );
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runObjectMethodArrowCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
