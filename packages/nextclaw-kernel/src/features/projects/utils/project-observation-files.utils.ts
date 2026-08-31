import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ProjectObservationArtifactCategory } from "@kernel/features/projects/utils/project-observation-config.utils.js";

export type ProjectObservedFile = {
  createdAt: string;
  relativePath: string;
  size: number;
  updatedAt: string;
};

export type ProjectArtifactFileMatch = ProjectObservedFile & {
  categoryId: string;
  categoryLabel: string;
};

export type ProjectFileIssue = {
  code: string;
  message: string;
  projectRelativePath?: string;
};

const IGNORED_DIRECTORIES = new Set([".git", ".hg", ".svn", "node_modules"]);
const MAX_ARTIFACT_FILES = 10_000;
const MAX_DEPTH = 12;

const toPortablePath = (value: string): string => value.split(sep).join("/");

function globSearchBase(pattern: string): string {
  const segments = pattern.split("/");
  const firstDynamicSegment = segments.findIndex((segment) => segment.includes("*") || segment.includes("?"));
  if (firstDynamicSegment >= 0) {
    return segments.slice(0, firstDynamicSegment).join("/");
  }
  return segments.slice(0, -1).join("/");
}

function shouldVisitDirectory(relativeDirectory: string, searchBases: string[]): boolean {
  if (!relativeDirectory) {
    return true;
  }
  return searchBases.some((base) => !base
    || base === relativeDirectory
    || base.startsWith(`${relativeDirectory}/`)
    || relativeDirectory.startsWith(`${base}/`));
}

function compareFileRecency(left: ProjectObservedFile, right: ProjectObservedFile): number {
  return left.updatedAt.localeCompare(right.updatedAt)
    || left.relativePath.localeCompare(right.relativePath);
}

function siftOldestFileDown(files: ProjectObservedFile[], index: number): void {
  let parent = index;
  while (true) {
    const left = parent * 2 + 1;
    const right = left + 1;
    let oldest = parent;
    if (left < files.length && compareFileRecency(files[left], files[oldest]) < 0) oldest = left;
    if (right < files.length && compareFileRecency(files[right], files[oldest]) < 0) oldest = right;
    if (oldest === parent) return;
    [files[parent], files[oldest]] = [files[oldest], files[parent]];
    parent = oldest;
  }
}

function keepMostRecentArtifactFile(
  files: ProjectObservedFile[],
  file: ProjectObservedFile,
  maxArtifactFiles: number,
): void {
  if (files.length < maxArtifactFiles) {
    files.push(file);
    let child = files.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (compareFileRecency(files[child], files[parent]) >= 0) break;
      [files[child], files[parent]] = [files[parent], files[child]];
      child = parent;
    }
    return;
  }
  if (compareFileRecency(file, files[0]) <= 0) return;
  files[0] = file;
  siftOldestFileDown(files, 0);
}

export function normalizeProjectRelativePath(value: string): string | null {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || isAbsolute(normalized)) {
    return null;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }
  return segments.join("/");
}

export function resolveInsideProject(rootPath: string, projectRelativePath: string): string | null {
  const normalized = normalizeProjectRelativePath(projectRelativePath);
  if (!normalized) {
    return null;
  }
  const target = resolve(rootPath, normalized);
  const targetRelative = relative(rootPath, target);
  return targetRelative && !targetRelative.startsWith(`..${sep}`) && targetRelative !== ".."
    ? target
    : null;
}

export async function observeProjectFile(
  rootPath: string,
  projectRelativePath: string,
): Promise<ProjectObservedFile | null> {
  const target = resolveInsideProject(rootPath, projectRelativePath);
  if (!target) {
    return null;
  }
  try {
    const targetLstat = await lstat(target);
    if (targetLstat.isSymbolicLink() || !targetLstat.isFile()) {
      return null;
    }
    const canonicalRoot = await realpath(rootPath);
    const canonicalTarget = await realpath(target);
    const canonicalRelative = relative(canonicalRoot, canonicalTarget);
    if (canonicalRelative.startsWith(`..${sep}`) || canonicalRelative === "..") {
      return null;
    }
    const targetStat = await stat(canonicalTarget);
    return {
      createdAt: targetStat.birthtime.toISOString(),
      relativePath: normalizeProjectRelativePath(projectRelativePath)!,
      size: targetStat.size,
      updatedAt: targetStat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

function globToRegExp(pattern: string): RegExp | null {
  const normalized = normalizeProjectRelativePath(pattern);
  if (!normalized) {
    return null;
  }
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === "*" && next === "*") {
      const after = normalized[index + 2];
      source += after === "/" ? "(?:.*/)?" : ".*";
      index += after === "/" ? 2 : 1;
      continue;
    }
    if (character === "*") {
      source += "[^/]*";
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    source += /[|\\{}()[\]^$+?.]/.test(character) ? `\\${character}` : character;
  }
  return new RegExp(`${source}$`);
}

export async function scanProjectArtifactFiles(
  rootPath: string,
  categories: ProjectObservationArtifactCategory[],
  options: { maxArtifactFiles?: number } = {},
): Promise<{ matches: ProjectArtifactFileMatch[]; issues: ProjectFileIssue[] }> {
  const issues: ProjectFileIssue[] = [];
  const compiled = categories.flatMap((category) => category.include.flatMap((pattern) => {
    const matcher = globToRegExp(pattern);
    if (!matcher) {
      issues.push({
        code: "PROJECT_ARTIFACT_PATTERN_INVALID",
        message: `Artifact pattern '${pattern}' is not a safe project-relative glob.`,
        projectRelativePath: pattern,
      });
      return [];
    }
    return [{ ...category, pattern, matcher }];
  }));
  if (compiled.length === 0) {
    return { matches: [], issues };
  }
  const files: ProjectObservedFile[] = [];
  let matchedFileCount = 0;
  const maxArtifactFiles = options.maxArtifactFiles ?? MAX_ARTIFACT_FILES;
  const searchBases = [...new Set(compiled.map((rule) => globSearchBase(rule.pattern)))];
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) {
      return;
    }
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        const relativeDirectory = toPortablePath(relative(rootPath, absolutePath));
        if (!IGNORED_DIRECTORIES.has(entry.name) && shouldVisitDirectory(relativeDirectory, searchBases)) {
          await visit(absolutePath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = toPortablePath(relative(rootPath, absolutePath));
      if (!compiled.some((rule) => rule.matcher.test(relativePath))) {
        continue;
      }
      const fileStat = await stat(absolutePath);
      matchedFileCount += 1;
      keepMostRecentArtifactFile(files, {
        createdAt: fileStat.birthtime.toISOString(),
        relativePath,
        size: fileStat.size,
        updatedAt: fileStat.mtime.toISOString(),
      }, maxArtifactFiles);
    }
  };
  try {
    await visit(rootPath, 0);
  } catch (error) {
    issues.push({
      code: "PROJECT_ARTIFACT_SCAN_FAILED",
      message: error instanceof Error ? error.message : "Project artifact scan failed.",
    });
  }
  if (matchedFileCount > maxArtifactFiles) {
    issues.push({
      code: "PROJECT_ARTIFACT_SCAN_LIMIT",
      message: `Showing the ${maxArtifactFiles} most recently updated files out of ${matchedFileCount} matched artifacts.`,
    });
  }
  const matchesByPath = new Map<string, ProjectArtifactFileMatch>();
  for (const rule of compiled) {
    for (const file of files) {
      if (!rule.matcher.test(file.relativePath) || matchesByPath.has(file.relativePath)) {
        continue;
      }
      matchesByPath.set(file.relativePath, {
        ...file,
        categoryId: rule.id,
        categoryLabel: rule.label,
      });
    }
  }
  return { matches: [...matchesByPath.values()], issues };
}
