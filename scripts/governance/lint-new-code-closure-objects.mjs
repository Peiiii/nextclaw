#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";
import {
  collectAddedLinesByFile,
  collectChangedWorkspaceFiles,
  collectPatternNames,
  collectReferencedIdentifiers,
  defaultSortByLocation,
  hasAddedLineInRange,
  isFunctionLike,
  parseDiffCheckArgs,
  rootDir,
  walkAst
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-closure-objects.mjs
  node scripts/governance/lint-new-code-closure-objects.mjs --staged
  node scripts/governance/lint-new-code-closure-objects.mjs --base origin/main
  node scripts/governance/lint-new-code-closure-objects.mjs -- packages/nextclaw/src

Checks touched factory functions that return closure-backed multi-method objects.
If a touched factory returns a stateful object with multiple callable entries sharing captured state, promote it to a class or explicit owner abstraction.`;

const lifecycleNames = new Set([
  "start",
  "stop",
  "reset",
  "clear",
  "dispose",
  "destroy",
  "reload",
  "connect",
  "disconnect",
  "subscribe",
  "unsubscribe",
  "open",
  "close",
  "resume",
  "pause",
  "flush",
  "publish",
  "schedule",
  "sync",
  "hydrate"
]);

const getFactoryName = (node, parent) => {
  if (node.type === "FunctionDeclaration" && node.id?.type === "Identifier") {
    return node.id.name;
  }
  if (parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }
  if (parent?.type === "Property" && parent.key) {
    if (parent.key.type === "Identifier") {
      return parent.key.name;
    }
    if (parent.key.type === "Literal") {
      return String(parent.key.value);
    }
  }
  return "<anonymous factory>";
};

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
  if (key.type === "PrivateIdentifier") {
    return `#${key.name}`;
  }
  return "<computed>";
};

const collectReturnedObjectExpressions = (node) => {
  const objects = [];
  if (node.type === "ArrowFunctionExpression" && node.expression && node.body?.type === "ObjectExpression") {
    objects.push(node.body);
    return objects;
  }
  if (!node.body || node.body.type !== "BlockStatement") {
    return objects;
  }

  const visit = (current) => {
    if (!current || typeof current !== "object") {
      return;
    }
    if (current !== node && isFunctionLike(current)) {
      return;
    }
    if (current.type === "ReturnStatement" && current.argument?.type === "ObjectExpression") {
      objects.push(current.argument);
      return;
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

  visit(node.body);
  return objects;
};

const collectFunctionScopeBindings = (fnNode) => {
  const names = new Set();
  const mutableNames = new Set();

  for (const param of fnNode.params ?? []) {
    collectPatternNames(param, names);
  }

  const visit = (current) => {
    if (!current || typeof current !== "object") {
      return;
    }
    if (current !== fnNode && isFunctionLike(current)) {
      if (current.type === "FunctionDeclaration" && current.id?.type === "Identifier") {
        names.add(current.id.name);
      }
      return;
    }
    if (current.type === "ClassDeclaration" && current.id?.type === "Identifier") {
      names.add(current.id.name);
      return;
    }
    if (current.type === "VariableDeclaration") {
      for (const declaration of current.declarations) {
        const before = new Set(names);
        collectPatternNames(declaration.id, names);
        for (const name of names) {
          if (!before.has(name) && current.kind !== "const") {
            mutableNames.add(name);
          }
        }
      }
    }
    if (current.type === "FunctionDeclaration" && current.id?.type === "Identifier") {
      names.add(current.id.name);
      return;
    }
    if (current.type === "CatchClause") {
      collectPatternNames(current.param, names);
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
  return { names, mutableNames };
};

const collectLocalBindingsInsideCallable = (callableNode) => {
  const names = new Set();
  for (const param of callableNode.params ?? []) {
    collectPatternNames(param, names);
  }
  const visit = (current) => {
    if (!current || typeof current !== "object") {
      return;
    }
    if (current !== callableNode && isFunctionLike(current)) {
      if (current.type === "FunctionDeclaration" && current.id?.type === "Identifier") {
        names.add(current.id.name);
      }
      return;
    }
    if (current.type === "VariableDeclaration") {
      for (const declaration of current.declarations) {
        collectPatternNames(declaration.id, names);
      }
    }
    if (current.type === "FunctionDeclaration" && current.id?.type === "Identifier") {
      names.add(current.id.name);
      return;
    }
    if (current.type === "ClassDeclaration" && current.id?.type === "Identifier") {
      names.add(current.id.name);
      return;
    }
    if (current.type === "CatchClause") {
      collectPatternNames(current.param, names);
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

  visit(callableNode.body ?? callableNode);
  return names;
};

const collectCallableEntries = (objectExpression) =>
  objectExpression.properties
    .filter((property) => property.type === "Property" && property.kind === "init")
    .map((property) => {
      if (property.method) {
        return {
          name: getPropertyName(property),
          callableNode: property.value,
          line: property.loc?.start.line ?? objectExpression.loc?.start.line ?? 0,
          property
        };
      }
      if (property.value?.type === "FunctionExpression" || property.value?.type === "ArrowFunctionExpression") {
        return {
          name: getPropertyName(property),
          callableNode: property.value,
          line: property.loc?.start.line ?? objectExpression.loc?.start.line ?? 0,
          property
        };
      }
      return null;
    })
    .filter(Boolean);

export const collectClosureObjectViolations = ({ filePath, source, addedLines }) => {
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
    if (!isFunctionLike(node) || !node.loc || !hasAddedLineInRange(addedLines, node.loc.start.line, node.loc.end.line)) {
      return;
    }

    const returnedObjects = collectReturnedObjectExpressions(node);
    if (returnedObjects.length === 0) {
      return;
    }

    const factoryName = getFactoryName(node, parent);
    const outerBindings = collectFunctionScopeBindings(node);

    for (const objectExpression of returnedObjects) {
      const callableEntries = collectCallableEntries(objectExpression);
      if (callableEntries.length < 3) {
        continue;
      }

      const capturedByName = new Map();
      let capturedEntryCount = 0;
      let mutableCaptured = false;

      for (const entry of callableEntries) {
        const localBindings = collectLocalBindingsInsideCallable(entry.callableNode);
        const referenced = collectReferencedIdentifiers(entry.callableNode);
        const captured = [...referenced].filter(
          (name) => outerBindings.names.has(name) && !localBindings.has(name)
        );
        if (captured.length > 0) {
          capturedEntryCount += 1;
        }
        for (const name of captured) {
          capturedByName.set(name, (capturedByName.get(name) ?? 0) + 1);
          if (outerBindings.mutableNames.has(name)) {
            mutableCaptured = true;
          }
        }
      }

      const sharedCapturedCount = [...capturedByName.values()].filter((count) => count >= 2).length;
      const lifecycleCount = callableEntries.filter((entry) => lifecycleNames.has(entry.name)).length;
      if (capturedEntryCount < 2) {
        continue;
      }
      if (sharedCapturedCount === 0 && !mutableCaptured && lifecycleCount < 2 && callableEntries.length < 4) {
        continue;
      }

      violations.push({
        filePath,
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
        ownerLine: node.loc.start.line,
        factoryName,
        callableCount: callableEntries.length,
        capturedEntryCount,
        lifecycleCount,
        message: `touched closure-backed factory ${factoryName} returns a multi-method owner object; promote it to a class or explicit owner abstraction`
      });
      break;
    }
  });

  return violations;
};

export const runClosureObjectCheck = (options) => {
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
    violations.push(...collectClosureObjectViolations({ filePath, source, addedLines }));
  }

  return {
    changedFiles,
    violations: defaultSortByLocation(violations, "ownerLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Closure-owner diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Closure-owner diff check failed.");
  console.error("Promote touched closure-backed multi-method factory objects to a class or explicit owner abstraction.");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line}:${violation.column} ${violation.message}`);
  }
  console.error(`Found ${violations.length} violation(s) across ${new Set(violations.map((item) => item.filePath)).size} file(s).`);
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runClosureObjectCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
