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
  node scripts/governance/lint-new-code-context-destructuring.mjs
  node scripts/governance/lint-new-code-context-destructuring.mjs --staged
  node scripts/governance/lint-new-code-context-destructuring.mjs --base origin/main
  node scripts/governance/lint-new-code-context-destructuring.mjs -- packages/nextclaw/src

Checks touched functions in changed TypeScript workspace files.
If a touched function repeatedly reads params/options/context style objects 4+ times,
it must destructure the top-level fields instead of repeating context.* access.`;

const CONTEXT_DESTRUCTURING_CHECK_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs"
]);

const TARGET_PARAM_NAMES = new Set(["params", "options", "context"]);
const MIN_MEMBER_ACCESS_COUNT = 4;

const isFunctionNode = (node) =>
  node?.type === "FunctionDeclaration" ||
  node?.type === "FunctionExpression" ||
  node?.type === "ArrowFunctionExpression";

const resolveFunctionName = (node) => {
  if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id?.type === "Identifier") {
    return node.id.name;
  }

  let current = node.parent;
  while (current) {
    if (current.type === "VariableDeclarator" && current.id.type === "Identifier") {
      return current.id.name;
    }
    if (current.type === "Property" && current.key.type === "Identifier" && !current.computed) {
      return current.key.name;
    }
    if (current.type === "MethodDefinition" && current.key.type === "Identifier" && !current.computed) {
      return current.key.name;
    }
    current = current.parent;
  }

  return "this function";
};

const collectRootMemberAccesses = (functionNode, paramName) => {
  const memberExpressions = [];

  const visit = (node) => {
    if (!node) {
      return;
    }
    if (node.type === "ChainExpression") {
      visit(node.expression);
      return;
    }
    if (node !== functionNode && isFunctionNode(node)) {
      return;
    }
    if (
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      node.object.name === paramName &&
      !node.computed
    ) {
      memberExpressions.push(node);
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "parent" || !value) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item.type === "string") {
            visit(item);
          }
        }
        continue;
      }
      if (typeof value.type === "string") {
        visit(value);
      }
    }
  };

  visit(functionNode.body);
  return memberExpressions;
};

export const collectContextDestructuringViolationsForTouchedFunctions = ({ filePath, source, addedLines }) => {
  if (!addedLines || addedLines.size === 0) {
    return [];
  }
  if (!CONTEXT_DESTRUCTURING_CHECK_EXTENSIONS.has(resolve(filePath).match(/\.[^./]+$/)?.[0] ?? "")) {
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
  walkAst(ast, (node) => {
    if (!isFunctionNode(node) || !node.loc || !node.body) {
      return;
    }
    if (!hasAddedLineInRange(addedLines, node.loc.start.line, node.loc.end.line)) {
      return;
    }

    const functionName = resolveFunctionName(node);
    for (const param of node.params) {
      if (param.type !== "Identifier" || !TARGET_PARAM_NAMES.has(param.name) || !param.loc) {
        continue;
      }

      const memberExpressions = collectRootMemberAccesses(node, param.name);
      if (memberExpressions.length < MIN_MEMBER_ACCESS_COUNT) {
        continue;
      }

      violations.push({
        filePath,
        functionName,
        paramName: param.name,
        count: memberExpressions.length,
        line: param.loc.start.line,
        column: param.loc.start.column + 1,
        functionStartLine: node.loc.start.line
      });
    }
  });

  return violations;
};

export const runContextDestructuringCheck = (options) => {
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
    violations.push(...collectContextDestructuringViolationsForTouchedFunctions({ filePath, source, addedLines }));
  }

  return {
    changedFiles,
    violations: defaultSortByLocation(violations, "functionStartLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Context destructuring diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Context destructuring diff check failed.");
  console.error("Touched functions must destructure top-level fields from params/options/context once repeated reads reach the governance threshold.");
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line}:${violation.column} ${violation.functionName} should destructure '${violation.paramName}' before reading ${violation.paramName}.* ${violation.count} times`
    );
  }
  console.error(
    `Found ${violations.length} violation(s) across ${new Set(violations.map((item) => `${item.filePath}:${item.functionStartLine}`)).size} touched function(s).`
  );
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runContextDestructuringCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
