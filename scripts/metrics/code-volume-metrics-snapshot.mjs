import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const NESTED_SCOPE_ROOTS = {
  packages: new Set(["extensions", "ncp-packages"])
};

export const detectLanguage = (extension) => {
  if (extension === ".ts") return "TypeScript";
  if (extension === ".tsx") return "TSX";
  if (extension === ".js") return "JavaScript";
  if (extension === ".jsx") return "JSX";
  if (extension === ".mjs") return "MJS";
  if (extension === ".cjs") return "CJS";
  return extension.slice(1).toUpperCase();
};

export const detectScope = (relativePath) => {
  const segments = relativePath.split("/");
  const [firstSegment, secondSegment, thirdSegment] = segments;

  if (firstSegment && secondSegment && NESTED_SCOPE_ROOTS[firstSegment]?.has(secondSegment) && thirdSegment) {
    return `${firstSegment}/${secondSegment}/${thirdSegment}`;
  }

  if (
    (firstSegment === "packages" || firstSegment === "extensions" || firstSegment === "apps" || firstSegment === "workers") &&
    secondSegment
  ) {
    return `${firstSegment}/${secondSegment}`;
  }
  if (firstSegment) {
    return firstSegment;
  }
  return "root";
};

export const detectFileClassification = (relativePath) =>
  /(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:test|spec)\./i.test(relativePath.split("\\").join("/")) ? "test" : "source";

export const countLines = (content, extension) => {
  const lines = content.split(/\r?\n/);
  let blankLines = 0;
  let commentLines = 0;
  let codeLines = 0;

  const lineCommentPrefixes = ["//"];
  const supportsBlockComment = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension);
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      blankLines += 1;
      continue;
    }

    if (supportsBlockComment && inBlockComment) {
      commentLines += 1;
      if (line.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (supportsBlockComment && line.startsWith("/*")) {
      commentLines += 1;
      if (!line.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }

    if (supportsBlockComment && line.startsWith("*")) {
      commentLines += 1;
      continue;
    }

    if (lineCommentPrefixes.some((prefix) => line.startsWith(prefix))) {
      commentLines += 1;
      continue;
    }

    codeLines += 1;
  }

  return {
    totalLines: lines.length,
    blankLines,
    commentLines,
    codeLines
  };
};

export const listTrackedFiles = (repoRoot, includePaths, includeExtensions, excludeDirs) => {
  const files = new Set();
  const includeExtensionSet = new Set(includeExtensions);
  const excludeDirSet = new Set(excludeDirs);

  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (excludeDirSet.has(entry.name)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!includeExtensionSet.has(extension)) {
        continue;
      }

      files.add(absolutePath);
    }
  };

  for (const includePath of includePaths) {
    const absolutePath = resolve(repoRoot, includePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (!stats.isFile()) {
      continue;
    }

    const extension = extname(absolutePath).toLowerCase();
    if (!includeExtensionSet.has(extension)) {
      continue;
    }
    files.add(absolutePath);
  }

  return [...files].sort();
};

const createMetricBucket = () => Object.fromEntries(
  ["files", "totalLines", "blankLines", "commentLines", "codeLines", "testCodeLines"]
    .map((key) => [key, 0])
);

const mergeMetrics = (target, increment, classification) => {
  const nextMetrics = {
    ...target,
    files: target.files + increment.files,
    totalLines: target.totalLines + increment.totalLines,
    blankLines: target.blankLines + increment.blankLines,
    commentLines: target.commentLines + increment.commentLines
  };
  if (classification === "test") {
    return {
      ...nextMetrics,
      testCodeLines: target.testCodeLines + increment.codeLines
    };
  }
  return {
    ...nextMetrics,
    codeLines: target.codeLines + increment.codeLines
  };
};

const toSortedArray = (map) =>
  [...map.entries()]
    .map(([name, metrics]) => ({ name, ...metrics }))
    .sort((left, right) => right.codeLines - left.codeLines || right.files - left.files || left.name.localeCompare(right.name));

export function collectDetailedSnapshot({
  repoRoot,
  scopeProfile,
  includePaths,
  includeExtensions,
  excludeDirs,
  gitSha,
  gitRef,
  generatedAt
}) {
  const trackedFiles = listTrackedFiles(repoRoot, includePaths, includeExtensions, excludeDirs);
  let totals = createMetricBucket();
  const byLanguage = new Map();
  const byScope = new Map();
  const byFile = [];

  for (const filePath of trackedFiles) {
    const extension = extname(filePath).toLowerCase();
    const language = detectLanguage(extension);
    const relativePath = relative(repoRoot, filePath).split("\\").join("/");
    const scope = detectScope(relativePath);
    const classification = detectFileClassification(relativePath);
    const content = readFileSync(filePath, "utf8");
    const lineMetrics = countLines(content, extension);
    const increment = {
      files: 1,
      totalLines: lineMetrics.totalLines,
      blankLines: lineMetrics.blankLines,
      commentLines: lineMetrics.commentLines,
      codeLines: lineMetrics.codeLines
    };

    totals = mergeMetrics(totals, increment, classification);
    byLanguage.set(language, mergeMetrics(byLanguage.get(language) ?? createMetricBucket(), increment, classification));
    byScope.set(scope, mergeMetrics(byScope.get(scope) ?? createMetricBucket(), increment, classification));

    byFile.push({
      path: relativePath,
      scope,
      language,
      ...increment,
      codeLines: classification === "test" ? 0 : lineMetrics.codeLines
    });
  }

  return {
    generatedAt,
    projectRoot: repoRoot,
    git: {
      sha: gitSha,
      ref: gitRef
    },
    scope: {
      profile: scopeProfile,
      includePaths,
      includeExtensions,
      excludeDirs,
      codeLineSemantics: "production-code-with-tests-separated"
    },
    totals,
    byLanguage: toSortedArray(byLanguage),
    byScope: toSortedArray(byScope),
    byFile: byFile.sort(
      (left, right) =>
        right.codeLines - left.codeLines ||
        right.totalLines - left.totalLines ||
        left.path.localeCompare(right.path)
    )
  };
}

export const collectSnapshot = collectDetailedSnapshot;
