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
  isFunctionLike,
  parseDiffCheckArgs,
  rootDir,
  walkAst
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-react-effects.mjs
  node scripts/governance/lint-new-code-react-effects.mjs --staged
  node scripts/governance/lint-new-code-react-effects.mjs --base origin/main
  node scripts/governance/lint-new-code-react-effects.mjs -- packages/nextclaw-ui/src

Checks touched React effects in changed workspace source files.
Touched useEffect/useLayoutEffect callbacks must stay focused on external-system synchronization.
Move business actions, state repair, and query/store mirroring back into query/view hooks, stores, managers, or presenters.`;

const REACT_EFFECT_CHECK_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs"
]);

const dangerousMemberCallKinds = new Map([
  ["mutate", "mutation trigger"],
  ["mutateAsync", "mutation trigger"],
  ["invalidateQueries", "query invalidation"],
  ["refetchQueries", "query invalidation"],
  ["resetQueries", "query invalidation"],
  ["removeQueries", "query invalidation"],
  ["cancelQueries", "query invalidation"],
  ["setQueryData", "query cache patch"],
  ["setQueriesData", "query cache patch"],
  ["refetch", "query refetch"],
  ["setState", "store state write"]
]);

const effectPropertyNames = new Set(["useEffect", "useLayoutEffect"]);
const useStatePropertyNames = new Set(["useState"]);

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
  if (!node) {
    return "<unknown>";
  }
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "Literal") {
    return String(node.value);
  }
  if (node.type === "PrivateIdentifier") {
    return `#${node.name}`;
  }
  return "<computed>";
};

const getCallLabel = (node) => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) {
    return "<unknown>";
  }
  if (unwrapped.type === "Identifier") {
    return unwrapped.name;
  }
  if (unwrapped.type === "MemberExpression") {
    return `${getCallLabel(unwrapped.object)}.${getPropertyName(unwrapped.property)}`;
  }
  return "<unknown>";
};

const collectReactBindingNames = (ast) => {
  const effectHookNames = new Set();
  const stateHookNames = new Set();
  const reactNamespaceNames = new Set();

  for (const statement of ast.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== "react") {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        if (specifier.imported.type === "Identifier" && effectPropertyNames.has(specifier.imported.name)) {
          effectHookNames.add(specifier.local.name);
          continue;
        }
        if (specifier.imported.type === "Identifier" && useStatePropertyNames.has(specifier.imported.name)) {
          stateHookNames.add(specifier.local.name);
        }
        continue;
      }
      reactNamespaceNames.add(specifier.local.name);
    }
  }

  return {
    effectHookNames,
    stateHookNames,
    reactNamespaceNames
  };
};

const isReactHookCall = ({ callNode, directHookNames, reactNamespaceNames, propertyNames }) => {
  const callee = unwrapExpression(callNode?.callee);
  if (!callee) {
    return false;
  }
  if (callee.type === "Identifier") {
    return directHookNames.has(callee.name);
  }
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    reactNamespaceNames.has(callee.object.name) &&
    propertyNames.has(getPropertyName(callee.property))
  ) {
    return true;
  }
  return false;
};

const getSelectorReturnExpression = (selectorNode) => {
  if (!selectorNode || !isFunctionLike(selectorNode)) {
    return null;
  }
  if (selectorNode.body.type !== "BlockStatement") {
    return selectorNode.body;
  }
  const returnStatement = selectorNode.body.body.find((statement) => statement.type === "ReturnStatement");
  return returnStatement?.argument ?? null;
};

const isStoreHookCall = (callNode) => {
  const callee = unwrapExpression(callNode?.callee);
  if (!callee) {
    return false;
  }
  if (callee.type === "Identifier") {
    return /^use[A-Z0-9].*Store$/.test(callee.name);
  }
  if (callee.type === "MemberExpression" && !callee.computed) {
    return /^use[A-Z0-9].*Store$/.test(getPropertyName(callee.property));
  }
  return false;
};

const collectEffectActionBindingNames = ({ ast, stateHookNames, reactNamespaceNames }) => {
  const stateSetterNames = new Set();
  const storeActionBindingNames = new Set();

  walkAst(ast, (node) => {
    if (node.type !== "VariableDeclarator") {
      return;
    }

    if (
      node.id.type === "ArrayPattern" &&
      node.id.elements.length >= 2 &&
      node.id.elements[1]?.type === "Identifier" &&
      node.init?.type === "CallExpression" &&
      isReactHookCall({
        callNode: node.init,
        directHookNames: stateHookNames,
        reactNamespaceNames,
        propertyNames: useStatePropertyNames
      })
    ) {
      stateSetterNames.add(node.id.elements[1].name);
      return;
    }

    if (
      node.id.type === "Identifier" &&
      node.init?.type === "CallExpression" &&
      isStoreHookCall(node.init)
    ) {
      const selectorReturn = unwrapExpression(getSelectorReturnExpression(node.init.arguments[0]));
      if (selectorReturn?.type === "MemberExpression" && !selectorReturn.computed) {
        storeActionBindingNames.add(node.id.name);
      }
    }
  });

  return {
    stateSetterNames,
    storeActionBindingNames
  };
};

const collectDirectEffectCalls = ({ rootNode, getDescriptor }) => {
  const descriptors = [];

  const visit = (current) => {
    if (!current || typeof current !== "object") {
      return;
    }

    if (current !== rootNode && isFunctionLike(current)) {
      return;
    }

    if (current.type === "CallExpression") {
      const descriptor = getDescriptor(current);
      if (descriptor) {
        descriptors.push(descriptor);
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

  visit(rootNode.body ?? rootNode);
  return descriptors;
};

const getDangerousEffectCall = ({ callNode, stateSetterNames, storeActionBindingNames }) => {
  const callee = unwrapExpression(callNode.callee);
  if (!callee) {
    return null;
  }

  if (callee.type === "Identifier") {
    if (stateSetterNames.has(callee.name)) {
      return {
        line: callNode.loc?.start.line ?? 1,
        column: (callNode.loc?.start.column ?? 0) + 1,
        callLabel: callee.name,
        reason: "local state repair"
      };
    }
    if (storeActionBindingNames.has(callee.name)) {
      return {
        line: callNode.loc?.start.line ?? 1,
        column: (callNode.loc?.start.column ?? 0) + 1,
        callLabel: callee.name,
        reason: "store action dispatch"
      };
    }
    return null;
  }

  if (callee.type !== "MemberExpression" || callee.computed) {
    return null;
  }

  const propertyName = getPropertyName(callee.property);
  const reason = dangerousMemberCallKinds.get(propertyName);
  if (!reason) {
    return null;
  }

  return {
    line: callNode.loc?.start.line ?? 1,
    column: (callNode.loc?.start.column ?? 0) + 1,
    callLabel: getCallLabel(callee),
    reason
  };
};

const getEffectHookLabel = (callNode) => {
  const callee = unwrapExpression(callNode.callee);
  if (callee?.type === "Identifier") {
    return callee.name;
  }
  if (callee?.type === "MemberExpression" && !callee.computed) {
    return getPropertyName(callee.property);
  }
  return "useEffect";
};

export const collectViolationsForTouchedReactEffects = ({ filePath, source, addedLines }) => {
  if (!addedLines || addedLines.size === 0) {
    return [];
  }
  if (!REACT_EFFECT_CHECK_EXTENSIONS.has(resolve(filePath).match(/\.[^./]+$/)?.[0] ?? "")) {
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

  const { effectHookNames, stateHookNames, reactNamespaceNames } = collectReactBindingNames(ast);
  if (effectHookNames.size === 0 && reactNamespaceNames.size === 0) {
    return [];
  }

  const { stateSetterNames, storeActionBindingNames } = collectEffectActionBindingNames({
    ast,
    stateHookNames,
    reactNamespaceNames
  });

  const violations = [];

  walkAst(ast, (node) => {
    if (
      node.type !== "CallExpression" ||
      !isReactHookCall({
        callNode: node,
        directHookNames: effectHookNames,
        reactNamespaceNames,
        propertyNames: effectPropertyNames
      })
    ) {
      return;
    }

    const effectCallback = unwrapExpression(node.arguments[0]);
    if (!effectCallback || !isFunctionLike(effectCallback) || !effectCallback.loc) {
      return;
    }
    if (!hasAddedLineInRange(addedLines, effectCallback.loc.start.line, effectCallback.loc.end.line)) {
      return;
    }

    const directCalls = collectDirectEffectCalls({
      rootNode: effectCallback,
      getDescriptor: (callNode) => getDangerousEffectCall({
        callNode,
        stateSetterNames,
        storeActionBindingNames
      })
    });

    for (const directCall of directCalls) {
      violations.push({
        filePath,
        effectStartLine: effectCallback.loc.start.line,
        effectHookLabel: getEffectHookLabel(node),
        line: directCall.line,
        column: directCall.column,
        callLabel: directCall.callLabel,
        reason: directCall.reason
      });
    }
  });

  return violations;
};

export const runReactEffectCheck = (options) => {
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
    violations.push(...collectViolationsForTouchedReactEffects({ filePath, source, addedLines }));
  }

  return {
    changedFiles,
    violations: defaultSortByLocation(violations, "effectStartLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`React effect owner-boundary diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("React effect owner-boundary diff check failed.");
  console.error("Touched React effects must stay focused on external-system synchronization.");
  console.error("Move business actions, state repair, and query/store mirroring back into query/view hooks, stores, managers, or presenters.");
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line}:${violation.column} ${violation.effectHookLabel} directly calls '${violation.callLabel}' (${violation.reason})`
    );
  }
  console.error(`Found ${violations.length} violation(s) across ${new Set(violations.map((item) => `${item.filePath}:${item.effectStartLine}`)).size} touched effect callback(s).`);
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runReactEffectCheck(options)));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
