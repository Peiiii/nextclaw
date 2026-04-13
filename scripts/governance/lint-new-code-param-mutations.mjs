#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";
import {
  collectAddedLinesByFile,
  collectChangedWorkspaceFiles,
  collectPatternNames,
  defaultSortByLocation,
  hasAddedLineInRange,
  isFunctionLike,
  parseDiffCheckArgs,
  rootDir
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-param-mutations.mjs
  node scripts/governance/lint-new-code-param-mutations.mjs --staged
  node scripts/governance/lint-new-code-param-mutations.mjs --base origin/main
  node scripts/governance/lint-new-code-param-mutations.mjs -- packages/nextclaw/src

Checks touched ordinary functions in changed workspace source files.
If a touched non-class function mutates one of its parameters, return a new value/patch or move the mutation under an explicit owner class instead of mutating the input object in place.`;

const mutatingMethodNames = new Set([
  "add",
  "append",
  "clear",
  "copyWithin",
  "delete",
  "fill",
  "pop",
  "push",
  "reverse",
  "set",
  "shift",
  "sort",
  "splice",
  "unshift"
]);

const unwrapExpression = (node) => {
  if (!node) {
    return null;
  }
  if (node.type === "ChainExpression") {
    return unwrapExpression(node.expression);
  }
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSNonNullExpression"
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
};

const getPropertyName = (node) => {
  const key = node.key;
  if (!key) {
    return "<anonymous>";
  }
  if (key.type === "Identifier") {
    return key.name;
  }
  if (key.type === "Literal") {
    return String(key.value);
  }
  return "<computed>";
};

const getAssignmentTargetLabel = (node) => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) {
    return "<unknown>";
  }
  if (unwrapped.type === "Identifier") {
    return unwrapped.name;
  }
  if (unwrapped.type === "MemberExpression") {
    if (!unwrapped.computed && unwrapped.property.type === "Identifier") {
      return `${getAssignmentTargetLabel(unwrapped.object)}.${unwrapped.property.name}`;
    }
    return `${getAssignmentTargetLabel(unwrapped.object)}[?]`;
  }
  return "<unknown>";
};

const getRootIdentifierName = (node) => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) {
    return null;
  }
  if (unwrapped.type === "Identifier") {
    return unwrapped.name;
  }
  if (unwrapped.type === "MemberExpression") {
    return getRootIdentifierName(unwrapped.object);
  }
  return null;
};

const getFunctionLabel = (node, parent) => {
  if (node.type === "FunctionDeclaration" && node.id?.type === "Identifier") {
    return node.id.name;
  }
  if (parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }
  if (parent?.type === "Property") {
    return getPropertyName(parent);
  }
  if (parent?.type === "AssignmentExpression") {
    return getAssignmentTargetLabel(parent.left);
  }
  if (parent?.type === "ExportDefaultDeclaration") {
    return "<default export>";
  }
  return "<anonymous function>";
};

const isClassOwnedFunction = (node, parent) => {
  if (parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition") {
    return true;
  }
  if (parent?.type === "Property" && parent.value === node) {
    return false;
  }
  return false;
};

const getMutationDescriptor = (node) => {
  if (!node) {
    return null;
  }

  if (node.type === "AssignmentExpression") {
    return {
      target: node.left,
      mutationKind: "assignment"
    };
  }

  if (node.type === "UpdateExpression") {
    return {
      target: node.argument,
      mutationKind: "update"
    };
  }

  if (node.type === "UnaryExpression" && node.operator === "delete") {
    return {
      target: node.argument,
      mutationKind: "delete"
    };
  }

  if (node.type !== "CallExpression") {
    return null;
  }

  const callee = unwrapExpression(node.callee);
  if (
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Object" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "assign" &&
    node.arguments.length > 0
  ) {
    return {
      target: node.arguments[0],
      mutationKind: "call:Object.assign"
    };
  }

  if (callee?.type === "MemberExpression") {
    const methodName = !callee.computed && callee.property.type === "Identifier" ? callee.property.name : null;
    if (methodName && mutatingMethodNames.has(methodName)) {
      return {
        target: callee.object,
        mutationKind: `call:${methodName}`
      };
    }
  }

  return null;
};

const collectMutationsInsideFunction = (fnNode, parameterNames) => {
  const violations = [];

  const visit = (current) => {
    if (!current || typeof current !== "object") {
      return;
    }

    if (current !== fnNode && isFunctionLike(current)) {
      return;
    }

    const mutation = getMutationDescriptor(current);
    if (mutation?.target) {
      const rootName = getRootIdentifierName(mutation.target);
      if (rootName && parameterNames.has(rootName)) {
        violations.push({
          line: current.loc?.start.line ?? fnNode.loc?.start.line ?? 1,
          column: (current.loc?.start.column ?? fnNode.loc?.start.column ?? 0) + 1,
          parameterName: rootName,
          targetLabel: getAssignmentTargetLabel(mutation.target),
          mutationKind: mutation.mutationKind
        });
      }
    }

    for (const value of Object.values(current)) {
      if (!value) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item);
        }
        continue;
      }
      if (typeof value.type === "string") {
        visit(value);
      }
    }
  };

  visit(fnNode.body);
  return violations;
};

export const collectViolationsForTouchedFunctionParamMutations = ({ filePath, source, addedLines }) => {
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

  const visit = (current, parent = null) => {
    if (!current || typeof current !== "object") {
      return;
    }

    if (isFunctionLike(current)) {
      if (!isClassOwnedFunction(current, parent) && current.loc && hasAddedLineInRange(addedLines, current.loc.start.line, current.loc.end.line)) {
        const parameterNames = new Set();
        for (const param of current.params ?? []) {
          collectPatternNames(param, parameterNames);
        }
        if (parameterNames.size > 0) {
          const functionLabel = getFunctionLabel(current, parent);
          for (const mutation of collectMutationsInsideFunction(current, parameterNames)) {
            violations.push({
              filePath,
              functionLabel,
              functionStartLine: current.loc.start.line,
              line: mutation.line,
              column: mutation.column,
              parameterName: mutation.parameterName,
              targetLabel: mutation.targetLabel,
              mutationKind: mutation.mutationKind
            });
          }
        }
      }
      return;
    }

    for (const value of Object.values(current)) {
      if (!value) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item, current);
        }
        continue;
      }
      if (typeof value.type === "string") {
        visit(value, current);
      }
    }
  };

  visit(ast, null);
  return violations;
};

export const runParamMutationCheck = (options) => {
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
    violations.push(...collectViolationsForTouchedFunctionParamMutations({ filePath, source, addedLines }));
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
    console.log(`Function param-mutation diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Function param-mutation diff check failed.");
  console.error("Touched ordinary functions must not mutate their input parameters in place.");
  console.error("Return a new value/patch, or move the mutation behind an explicit owner class instead of mutating the input object.");
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line}:${violation.column} ${violation.functionLabel} mutates parameter '${violation.parameterName}' via '${violation.targetLabel}' (${violation.mutationKind})`
    );
  }
  console.error(`Found ${violations.length} violation(s) across ${new Set(violations.map((item) => `${item.filePath}:${item.functionStartLine}`)).size} touched function(s).`);
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runParamMutationCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
