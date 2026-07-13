import { realpathSync } from "node:fs";
import { relative } from "node:path";

export const normalizeWatchPath = (filePath) => filePath.replaceAll("\\", "/");

function toRelativeWatchPath(baseDir, targetPath) {
  const normalizedRelative = normalizeWatchPath(relative(baseDir, targetPath));
  if (!normalizedRelative || normalizedRelative === ".") {
    return null;
  }
  return normalizedRelative.startsWith("./") ? normalizedRelative : `./${normalizedRelative}`;
}

function readWatchPathCandidates(targetPath) {
  const candidates = [normalizeWatchPath(targetPath)];
  try {
    candidates.push(normalizeWatchPath(realpathSync(targetPath)));
  } catch {
    // Non-existent or inaccessible paths still keep their lexical watch candidate.
  }
  return candidates;
}

export function buildTsxWatchExcludeGlobs(baseDir, targetPaths) {
  const candidates = new Set();
  for (const targetPath of targetPaths) {
    for (const candidate of readWatchPathCandidates(targetPath)) {
      candidates.add(candidate);
    }
  }
  const patterns = new Set();
  for (const candidate of candidates) {
    patterns.add(candidate);
    patterns.add(`${candidate}/**`);
    const relativeCandidate = toRelativeWatchPath(baseDir, candidate);
    if (relativeCandidate) {
      patterns.add(relativeCandidate);
      patterns.add(`${relativeCandidate}/**`);
    }
  }
  return [...patterns];
}
