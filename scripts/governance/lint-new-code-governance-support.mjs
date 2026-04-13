import { execFileSync } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const governedRoots = ["apps", "packages", "workers", "scripts"];
const supportedSourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

export const parseDiffCheckArgs = (argv, usage) => {
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

export const toPosixPath = (input) => input.split(sep).join("/");

export const isGovernedWorkspaceFile = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const extension = normalizedPath.slice(normalizedPath.lastIndexOf("."));
  if (!supportedSourceExtensions.has(extension)) {
    return false;
  }
  if (normalizedPath.endsWith(".d.ts")) {
    return false;
  }
  if (normalizedPath.includes("/dist/") || normalizedPath.includes("/ui-dist/")) {
    return false;
  }
  return governedRoots.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`));
};

export const runGit = (args, { allowFailure = false } = {}) => {
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
    .filter(isGovernedWorkspaceFile);
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

export const collectChangedWorkspaceFiles = (options, defaultPaths = ["apps", "packages", "workers", "scripts"]) => {
  const pathArgs = options.paths.length > 0 ? options.paths : defaultPaths;
  const changedTrackedFiles = runGit(getDiffCommandArgs("names", pathArgs, options), { allowFailure: true })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isGovernedWorkspaceFile);
  const untrackedFiles = collectUntrackedFiles(pathArgs, options);
  const changedFiles = Array.from(new Set([...changedTrackedFiles, ...untrackedFiles]))
    .sort((left, right) => left.localeCompare(right));

  return {
    pathArgs,
    changedFiles,
    untrackedFiles
  };
};

export const collectAddedLinesByFile = (pathArgs, untrackedFiles, options) => {
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
      currentFile = isGovernedWorkspaceFile(nextFile) ? nextFile : null;
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

export const hasAddedLineInRange = (addedLines, startLine, endLine) => {
  for (const line of addedLines) {
    if (line >= startLine && line <= endLine) {
      return true;
    }
  }
  return false;
};

export const walkAst = (node, visit, parent = null) => {
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
        walkAst(item, visit, node);
      }
      continue;
    }
    if (typeof value.type === "string") {
      walkAst(value, visit, node);
    }
  }
};

export const isFunctionLike = (node) => node && (
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ArrowFunctionExpression"
);

export const collectPatternNames = (pattern, names) => {
  if (!pattern) {
    return;
  }
  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return;
  }
  if (pattern.type === "AssignmentPattern") {
    collectPatternNames(pattern.left, names);
    return;
  }
  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      collectPatternNames(element, names);
    }
    return;
  }
  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (property.type === "Property") {
        collectPatternNames(property.value, names);
      } else if (property.type === "RestElement") {
        collectPatternNames(property.argument, names);
      }
    }
    return;
  }
  if (pattern.type === "RestElement") {
    collectPatternNames(pattern.argument, names);
  }
};

export const isIgnoredIdentifierUsage = (node, parent) => {
  if (!parent) {
    return false;
  }
  if ((parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && parent.key === node && !parent.computed) {
    return true;
  }
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) {
    return true;
  }
  if (parent.type === "VariableDeclarator" && parent.id === node) {
    return true;
  }
  if (isFunctionLike(parent) && (parent.id === node || parent.params.includes(node))) {
    return true;
  }
  if ((parent.type === "ClassDeclaration" || parent.type === "ClassExpression") && parent.id === node) {
    return true;
  }
  if (parent.type === "ImportSpecifier" || parent.type === "ImportDefaultSpecifier" || parent.type === "ImportNamespaceSpecifier") {
    return true;
  }
  if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") {
    return true;
  }
  if (parent.type === "CatchClause" && parent.param === node) {
    return true;
  }
  return false;
};

export const collectReferencedIdentifiers = (node) => {
  const names = new Set();
  walkAst(node, (current, parent) => {
    if (current.type !== "Identifier") {
      return;
    }
    if (isIgnoredIdentifierUsage(current, parent)) {
      return;
    }
    names.add(current.name);
  });
  return names;
};

export const defaultSortByLocation = (violations, ownerLineKey = null) => violations.sort((left, right) => {
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  if (ownerLineKey && left[ownerLineKey] !== right[ownerLineKey]) {
    return left[ownerLineKey] - right[ownerLineKey];
  }
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.column - right.column;
});
