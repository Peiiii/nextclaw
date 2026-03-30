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
  node scripts/lint-new-code-class-methods.mjs
  node scripts/lint-new-code-class-methods.mjs --staged
  node scripts/lint-new-code-class-methods.mjs --base origin/main
  node scripts/lint-new-code-class-methods.mjs -- packages/nextclaw/src

Checks only newly added class method definitions in changed TypeScript workspace files.
Violations are instance methods declared as foo() {} instead of foo = () => {}.
Ignored by design: constructor/get/set/static/abstract/override/decorated methods.`;

const parseArgs = (argv) => {
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

const options = parseArgs(process.argv.slice(2));

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

const collectUntrackedFiles = (pathArgs) => {
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

const getDiffCommandArgs = (mode, pathArgs) => {
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

const pathArgs = options.paths.length > 0 ? options.paths : ["apps", "packages", "workers"];

const changedTrackedFiles = runGit(getDiffCommandArgs("names", pathArgs), { allowFailure: true })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter(isWorkspaceTsFile);

const changedFiles = Array.from(new Set([...changedTrackedFiles, ...collectUntrackedFiles(pathArgs)])).sort((left, right) =>
  left.localeCompare(right)
);

if (changedFiles.length === 0) {
  console.log("No changed TypeScript workspace files to check.");
  process.exit(0);
}

const addedLinesByFile = new Map();

for (const filePath of collectUntrackedFiles(pathArgs)) {
  const source = readFileSync(resolve(rootDir, filePath), "utf8");
  const totalLines = source === "" ? 0 : source.split(/\r?\n/).length;
  addedLinesByFile.set(
    filePath,
    new Set(Array.from({ length: totalLines }, (_, index) => index + 1))
  );
}

const patchText = runGit(getDiffCommandArgs("patch", pathArgs), { allowFailure: true });
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

const walk = (node, visit) => {
  if (!node || typeof node !== "object") {
    return;
  }

  visit(node);

  for (const value of Object.values(node)) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, visit);
      }
      continue;
    }
    if (typeof value.type === "string") {
      walk(value, visit);
    }
  }
};

const violations = [];

for (const filePath of changedFiles) {
  const addedLines = addedLinesByFile.get(filePath);
  if (!addedLines || addedLines.size === 0) {
    continue;
  }

  const absoluteFilePath = resolve(rootDir, filePath);
  const source = readFileSync(absoluteFilePath, "utf8");
  const ast = parser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    loc: true,
    range: false,
    ecmaFeatures: {
      jsx: filePath.endsWith(".tsx")
    }
  });

  walk(ast, (node) => {
    if (node.type !== "MethodDefinition") {
      return;
    }
    if (node.kind !== "method") {
      return;
    }
    if (node.static) {
      return;
    }
    if (!node.loc || !addedLines.has(node.loc.start.line)) {
      return;
    }
    if (node.override === true || node.value?.override === true) {
      return;
    }
    if (node.abstract === true || node.value?.type === "TSEmptyBodyFunctionExpression") {
      return;
    }
    if (Array.isArray(node.decorators) && node.decorators.length > 0) {
      return;
    }

    violations.push({
      filePath,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
      methodName: getMethodName(node)
    });
  });
}

violations.sort((left, right) => {
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.column - right.column;
});

if (violations.length === 0) {
  console.log(`Class arrow-method diff check passed for ${changedFiles.length} changed file(s).`);
  process.exit(0);
}

console.error("Class arrow-method diff check failed.");
console.error("Use class fields for new instance methods: methodName = () => {}");
console.error("Preferred remediation: if one touched class trips this rule, convert that class's eligible instance methods in the same pass instead of fixing only the reported method.");
console.error("Ignored by design: constructor/get/set/static/abstract/override/decorated methods.");
for (const violation of violations) {
  console.error(`- ${violation.filePath}:${violation.line}:${violation.column} ${violation.methodName} should be an arrow-function class field`);
}
console.error(`Found ${violations.length} violation(s) across ${new Set(violations.map((item) => item.filePath)).size} file(s).`);
process.exit(1);
