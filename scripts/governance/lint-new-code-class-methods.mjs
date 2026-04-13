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
  node scripts/governance/lint-new-code-class-methods.mjs
  node scripts/governance/lint-new-code-class-methods.mjs --staged
  node scripts/governance/lint-new-code-class-methods.mjs --base origin/main
  node scripts/governance/lint-new-code-class-methods.mjs -- packages/nextclaw/src

Checks every touched class in changed TypeScript workspace files.
Once a class is touched by the diff, all eligible instance methods in that class must use foo = () => {}.
Ignored by design: constructor/get/set/static/abstract/override/decorated methods.`;

const getMethodName = (node) => {
  const key = node.key;
  if (!key) {
    return "<unknown>";
  }
  if (key.type === "Identifier") {
    return key.name;
  }
  if (key.type === "PrivateIdentifier") {
    return `#${key.name}`;
  }
  if (key.type === "Literal") {
    return String(key.value);
  }
  return "<computed>";
};

const getClassName = (node, parent) => {
  if (node.id?.type === "Identifier") {
    return node.id.name;
  }
  if (parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }
  if (parent?.type === "PropertyDefinition" && parent.key?.type === "Identifier") {
    return parent.key.name;
  }
  return "<anonymous class>";
};

const isEligibleInstanceMethod = (node) => {
  if (node.type !== "MethodDefinition") {
    return false;
  }
  if (node.kind !== "method") {
    return false;
  }
  if (node.static) {
    return false;
  }
  if (node.override === true || node.value?.override === true) {
    return false;
  }
  if (node.abstract === true || node.value?.type === "TSEmptyBodyFunctionExpression") {
    return false;
  }
  if (Array.isArray(node.decorators) && node.decorators.length > 0) {
    return false;
  }
  return Boolean(node.loc);
};

export const collectViolationsForTouchedClasses = ({ filePath, source, addedLines }) => {
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
    if (node.type !== "ClassDeclaration" && node.type !== "ClassExpression") {
      return;
    }
    if (!node.loc || !hasAddedLineInRange(addedLines, node.loc.start.line, node.loc.end.line)) {
      return;
    }

    const className = getClassName(node, parent);
    for (const member of node.body.body) {
      if (!isEligibleInstanceMethod(member)) {
        continue;
      }
      violations.push({
        filePath,
        className,
        line: member.loc.start.line,
        column: member.loc.start.column + 1,
        methodName: getMethodName(member),
        classStartLine: node.loc.start.line
      });
    }
  });

  return violations;
};

export const runClassMethodArrowCheck = (options) => {
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
    violations.push(...collectViolationsForTouchedClasses({ filePath, source, addedLines }));
  }

  return {
    changedFiles,
    violations: defaultSortByLocation(violations, "classStartLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Class arrow-method diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Class arrow-method diff check failed.");
  console.error("Use class fields for touched-class instance methods: methodName = () => {}");
  console.error("Once a class is touched, every eligible instance method in that class must use an arrow-function class field.");
  console.error("Ignored by design: constructor/get/set/static/abstract/override/decorated methods.");
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line}:${violation.column} ${violation.className}.${violation.methodName} should be an arrow-function class field`
    );
  }
  console.error(
    `Found ${violations.length} violation(s) across ${new Set(violations.map((item) => `${item.filePath}:${item.classStartLine}`)).size} touched class(es).`
  );
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runClassMethodArrowCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
