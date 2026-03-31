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
  isFunctionLike,
  parseDiffCheckArgs,
  rootDir,
  walkAst
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/lint-new-code-stateful-orchestrators.mjs
  node scripts/lint-new-code-stateful-orchestrators.mjs --staged
  node scripts/lint-new-code-stateful-orchestrators.mjs --base origin/main
  node scripts/lint-new-code-stateful-orchestrators.mjs -- packages/nextclaw/src

Checks touched modules that coordinate shared state through multiple top-level functions without an explicit owner.
If a touched file has module-scope state shared by several lifecycle-style functions, promote that orchestration to a class or explicit owner abstraction.`;

const lifecycleNamePattern = /^(start|stop|reset|clear|dispose|destroy|reload|connect|disconnect|subscribe|unsubscribe|resume|pause|open|close|flush|publish|schedule|sync|hydrate|init|initialize)/i;
const statefulNamePattern = /(state|cache|queue|pending|inFlight|listener|timer|interval|controller|registry|session|store)/i;
const statefulCtorNames = new Set(["Map", "Set", "WeakMap", "WeakSet", "AbortController"]);

const unwrapTopLevelStatement = (statement) => statement?.type === "ExportNamedDeclaration" ? statement.declaration : statement;

const collectFunctionLocalBindings = (fnNode) => {
  const names = new Set();
  for (const param of fnNode.params ?? []) {
    collectPatternNames(param, names);
  }
  walkAst(fnNode.body ?? fnNode, (node) => {
    if (node.type === "VariableDeclarator") {
      collectPatternNames(node.id, names);
      return;
    }
    if (node.type === "FunctionDeclaration" && node.id?.type === "Identifier") {
      names.add(node.id.name);
      return;
    }
    if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
      names.add(node.id.name);
      return;
    }
    if (node.type === "CatchClause") {
      collectPatternNames(node.param, names);
    }
  });
  return names;
};

const getTopLevelFunctionEntry = (statement) => {
  if (!statement) {
    return null;
  }
  if (statement.type === "FunctionDeclaration" && statement.id?.type === "Identifier") {
    return {
      name: statement.id.name,
      node: statement
    };
  }
  if (statement.type === "VariableDeclaration") {
    for (const declaration of statement.declarations) {
      if (
        declaration.id?.type === "Identifier" &&
        (declaration.init?.type === "ArrowFunctionExpression" || declaration.init?.type === "FunctionExpression")
      ) {
        return {
          name: declaration.id.name,
          node: declaration.init
        };
      }
    }
  }
  return null;
};

const isStatefulInitializer = (initializer, bindingName) => {
  if (!initializer) {
    return false;
  }
  if (initializer.type === "NewExpression" && initializer.callee.type === "Identifier" && statefulCtorNames.has(initializer.callee.name)) {
    return true;
  }
  if (initializer.type === "ArrayExpression" || initializer.type === "ObjectExpression") {
    return true;
  }
  if (bindingName && statefulNamePattern.test(bindingName)) {
    return true;
  }
  return false;
};

export const collectStatefulOrchestratorViolations = ({ filePath, source, addedLines }) => {
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

  const statefulBindings = new Set();
  const topLevelFunctions = [];
  let hasClassDeclaration = false;

  for (const rawStatement of ast.body) {
    const statement = unwrapTopLevelStatement(rawStatement);
    if (!statement) {
      continue;
    }
    if (statement.type === "ClassDeclaration") {
      hasClassDeclaration = true;
      continue;
    }
    if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations) {
        const bindingNames = new Set();
        collectPatternNames(declaration.id, bindingNames);
        for (const bindingName of bindingNames) {
          if (statement.kind !== "const" || isStatefulInitializer(declaration.init, bindingName)) {
            statefulBindings.add(bindingName);
          }
        }
      }
    }
    const functionEntry = getTopLevelFunctionEntry(statement);
    if (functionEntry) {
      topLevelFunctions.push(functionEntry);
    }
  }

  if (statefulBindings.size === 0 || topLevelFunctions.length < 3) {
    return [];
  }

  const participatingFunctions = [];
  const sharedBindingUsage = new Map();

  for (const functionEntry of topLevelFunctions) {
    const localBindings = collectFunctionLocalBindings(functionEntry.node);
    const refs = [...collectReferencedIdentifiers(functionEntry.node)].filter(
      (name) => statefulBindings.has(name) && !localBindings.has(name)
    );
    if (refs.length === 0) {
      continue;
    }
    for (const name of new Set(refs)) {
      sharedBindingUsage.set(name, (sharedBindingUsage.get(name) ?? 0) + 1);
    }
    participatingFunctions.push(functionEntry);
  }

  if (participatingFunctions.length < 3) {
    return [];
  }

  const lifecycleFunctions = participatingFunctions.filter((entry) => lifecycleNamePattern.test(entry.name));
  const sharedBindings = [...sharedBindingUsage.values()].filter((count) => count >= 2).length;
  if (lifecycleFunctions.length < 2 || sharedBindings === 0) {
    return [];
  }

  const ownerHint = hasClassDeclaration ? "promote the stateful top-level orchestration into the existing owner abstraction" : "introduce a class or explicit owner abstraction";
  return [{
    filePath,
    line: participatingFunctions[0].node.loc?.start.line ?? 1,
    column: participatingFunctions[0].node.loc?.start.column + 1 ?? 1,
    ownerLine: participatingFunctions[0].node.loc?.start.line ?? 1,
    message: `touched file shares module-scope state across ${participatingFunctions.length} top-level functions; ${ownerHint}`
  }];
};

export const runStatefulOrchestratorCheck = (options) => {
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
    violations.push(...collectStatefulOrchestratorViolations({ filePath, source, addedLines }));
  }
  return {
    changedFiles,
    violations: defaultSortByLocation(violations, "ownerLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed TypeScript workspace files to check.");
    return 0;
  }
  if (violations.length === 0) {
    console.log(`Stateful-orchestrator diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Stateful-orchestrator diff check failed.");
  console.error("Touched stateful orchestration should have an explicit owner abstraction instead of scattered top-level functions.");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line}:${violation.column} ${violation.message}`);
  }
  console.error(`Found ${violations.length} violation(s) across ${new Set(violations.map((item) => item.filePath)).size} file(s).`);
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runStatefulOrchestratorCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
