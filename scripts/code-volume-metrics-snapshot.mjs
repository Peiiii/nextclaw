import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const NESTED_SCOPE_ROOTS = {
  packages: new Set(["extensions", "ncp-packages"])
};

const detectLanguage = (extension) => {
  if (extension === ".ts") return "TypeScript";
  if (extension === ".tsx") return "TSX";
  if (extension === ".js") return "JavaScript";
  if (extension === ".jsx") return "JSX";
  if (extension === ".mjs") return "MJS";
  if (extension === ".cjs") return "CJS";
  return extension.slice(1).toUpperCase();
};

const detectScope = (relativePath) => {
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

const countLines = (content, extension) => {
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

const listTrackedFiles = (repoRoot, includePaths, includeExtensions, excludeDirs) => {
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

const mergeMetrics = (target, increment) => {
  target.files += increment.files;
  target.totalLines += increment.totalLines;
  target.blankLines += increment.blankLines;
  target.commentLines += increment.commentLines;
  target.codeLines += increment.codeLines;
};

const toSortedArray = (map) =>
  [...map.entries()]
    .map(([name, metrics]) => ({ name, ...metrics }))
    .sort((left, right) => right.codeLines - left.codeLines || right.files - left.files || left.name.localeCompare(right.name));

export const collectSnapshot = ({
  repoRoot,
  scopeProfile,
  includePaths,
  includeExtensions,
  excludeDirs,
  gitSha,
  gitRef,
  generatedAt
}) => {
  const trackedFiles = listTrackedFiles(repoRoot, includePaths, includeExtensions, excludeDirs);
  const totals = { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 };
  const byLanguage = new Map();
  const byScope = new Map();

  for (const filePath of trackedFiles) {
    const extension = extname(filePath).toLowerCase();
    const language = detectLanguage(extension);
    const relativePath = relative(repoRoot, filePath).split("\\").join("/");
    const scope = detectScope(relativePath);
    const content = readFileSync(filePath, "utf8");
    const lineMetrics = countLines(content, extension);
    const increment = {
      files: 1,
      totalLines: lineMetrics.totalLines,
      blankLines: lineMetrics.blankLines,
      commentLines: lineMetrics.commentLines,
      codeLines: lineMetrics.codeLines
    };

    mergeMetrics(totals, increment);

    if (!byLanguage.has(language)) {
      byLanguage.set(language, { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 });
    }
    mergeMetrics(byLanguage.get(language), increment);

    if (!byScope.has(scope)) {
      byScope.set(scope, { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 });
    }
    mergeMetrics(byScope.get(scope), increment);
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
      excludeDirs
    },
    totals,
    byLanguage: toSortedArray(byLanguage),
    byScope: toSortedArray(byScope)
  };
};
