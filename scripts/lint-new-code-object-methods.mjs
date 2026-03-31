#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoots = ["apps", "packages", "workers"];
const supportedExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

const usage = `Usage:
  node scripts/lint-new-code-object-methods.mjs
  node scripts/lint-new-code-object-methods.mjs --staged
  node scripts/lint-new-code-object-methods.mjs --base origin/main
  node scripts/lint-new-code-object-methods.mjs -- packages/nextclaw/src

Checks every touched object literal in changed TypeScript workspace files.
Once an object literal is touched by the diff, all eligible object methods in that object must use foo: () => {}.
Ignored by design: getters/setters, constructors are not applicable here.`;

export const parseArgs = (argv) => {
  const options = {
    baseRef: null,
    staged: false,
    paths: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (arg === "--staged") {
      options.staged = true;
      continue;
    }
    if (arg === "--base") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --base.");
      }
      options.baseRef = value;
      index += 1;
      continue;
    }
    if (arg === "--") {
      options.paths.push(...argv.slice(index + 1));
      break;
    }
    options.paths.push(arg);
  }

  if (options.baseRef && options.staged) {
    throw new Error("--base and --staged cannot be used together.");
  }

  return options;
};

const toPosixPath = (input) => input.split(sep).join("/");

const isWorkspaceTsFile = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const extension = normalizedPath.slice(normalizedPath.lastIndexOf("."));
  if (!supportedExtensions.has(extension)) {
    return false;
  }
  if (normalizedPath.endsWith(".d.ts")) {
    return false;
  }
  if (normalizedPath.includes("/dist/")) {
    return false;
  }
  return workspaceRoots.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`));
};

const runGit = (args, { allowFailure = false } = {}) => {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    throw error;
  }
};

const collectUntrackedFiles = (pathArgs, options) => {
  if (options.staged) {
    return [];
  }

  const output = runGit(["ls-files", "--others", "--exclude-standard", "--", ...pathArgs], {
    allowFailure: true
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isWorkspaceTsFile);
};

const getDiffCommandArgs = (mode, pathArgs, options) => {
  if (mode === "names") {
    if (options.baseRef) {
      return ["diff", "--name-only", "--diff-filter=AM", options.baseRef, "--", ...pathArgs];
    }
    if (options.staged) {
      return ["diff", "--cached", "--name-only", "--diff-filter=AM", "--", ...pathArgs];
    }
    return ["diff", "--name-only", "--diff-filter=AM", "HEAD", "--", ...pathArgs];
  }

  if (options.baseRef) {
    return ["diff", "--no-color", "--unified=0", "--diff-filter=AM", options.baseRef, "--", ...pathArgs];
  }
  if (options.staged) {
    return ["diff", "--cached", "--no-color", "--unified=0", "--diff-filter=AM", "--", ...pathArgs];
  }
  return ["diff", "--no-color", "--unified=0", "--diff-filter=AM", "HEAD", "--", ...pathArgs];
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
  return "<computed>";
};

const walk = (node, visit, parent = null) => {
  if (!node || typeof node !== "object") {
    return;
  }

  visit(node, parent);

  for (const value of Object.values(node)) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, visit, node);
      }
      continue;
    }
    if (typeof value.type === "string") {
      walk(value, visit, node);
    }
  }
};

const hasAddedLineInRange = (addedLines, startLine, endLine) => {
  for (const line of addedLines) {
    if (line >= startLine && line <= endLine) {
      return true;
    }
  }
  return false;
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
  walk(ast, (node, parent) => {
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

const sortViolations = (violations) => violations.sort((left, right) => {
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  if (left.objectStartLine !== right.objectStartLine) {
    return left.objectStartLine - right.objectStartLine;
  }
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.column - right.column;
});

const collectChangedFiles = (options) => {
  const pathArgs = options.paths.length > 0 ? options.paths : ["apps", "packages", "workers"];
  const changedTrackedFiles = runGit(getDiffCommandArgs("names", pathArgs, options), { allowFailure: true })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isWorkspaceTsFile);
  const untrackedFiles = collectUntrackedFiles(pathArgs, options);

  return {
    pathArgs,
    changedFiles: Array.from(new Set([...changedTrackedFiles, ...untrackedFiles])).sort((left, right) => left.localeCompare(right)),
    untrackedFiles
  };
};

const collectAddedLinesByFile = (pathArgs, untrackedFiles, options) => {
  const addedLinesByFile = new Map();

  for (const filePath of untrackedFiles) {
    const source = readFileSync(resolve(rootDir, filePath), "utf8");
    const totalLines = source === "" ? 0 : source.split(/\r?\n/).length;
    addedLinesByFile.set(
      filePath,
      new Set(Array.from({ length: totalLines }, (_, index) => index + 1))
    );
  }

  const patchText = runGit(getDiffCommandArgs("patch", pathArgs, options), { allowFailure: true });
  const patchLines = patchText.split("\n");
  let currentFile = null;
  let currentNewLine = 0;

  for (const line of patchLines) {
    if (line.startsWith("+++ b/")) {
      const nextFile = line.slice("+++ b/".length).trim();
      currentFile = isWorkspaceTsFile(nextFile) ? nextFile : null;
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      currentNewLine = Number(hunkMatch[1]);
      continue;
    }

    if (!currentFile || line.startsWith("diff --git ") || line.startsWith("--- ")) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const currentLines = addedLinesByFile.get(currentFile) ?? new Set();
      currentLines.add(currentNewLine);
      addedLinesByFile.set(currentFile, currentLines);
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      continue;
    }

    currentNewLine += 1;
  }

  return addedLinesByFile;
};

export const runObjectMethodArrowCheck = (options) => {
  const { pathArgs, changedFiles, untrackedFiles } = collectChangedFiles(options);
  if (changedFiles.length === 0) {
    return {
      changedFiles,
      violations: []
    };
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
    violations: sortViolations(violations)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed TypeScript workspace files to check.");
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
  const options = parseArgs(process.argv.slice(2));
  const exitCode = printViolations(runObjectMethodArrowCheck(options));
  process.exit(exitCode);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
