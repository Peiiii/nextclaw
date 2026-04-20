import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const workerRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(workerRoot, "dist");
const outputExtensions = [".js", ".mjs", ".cjs"];

const collectOutputFiles = (directoryPath, files = []) => {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectOutputFiles(entryPath, files);
      continue;
    }
    if (outputExtensions.includes(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
};

const resolveOutputSpecifier = (importSource) => {
  const targetPath = path.join(distRoot, importSource.slice(2));
  if (path.extname(targetPath) && statExists(targetPath)) {
    return targetPath;
  }
  for (const extension of outputExtensions) {
    if (statExists(`${targetPath}${extension}`)) {
      return `${targetPath}${extension}`;
    }
  }
  const indexCandidate = path.join(targetPath, "index.js");
  return statExists(indexCandidate) ? indexCandidate : null;
};

const statExists = (targetPath) => {
  try {
    return statSync(targetPath).isFile();
  } catch {
    return false;
  }
};

const rewriteAliases = (filePath) => {
  const fileDirectory = path.dirname(filePath);
  const source = readFileSync(filePath, "utf8");
  const rewritten = source.replace(
    /((?:import|export)\s[^"'`\n]*?\sfrom\s*["'])(@\/[^"']+)(["'])/g,
    (fullMatch, prefix, importSource, suffix) => {
      const resolvedTarget = resolveOutputSpecifier(importSource);
      if (!resolvedTarget) {
        return fullMatch;
      }
      let relativeSpecifier = path.relative(fileDirectory, resolvedTarget).replace(/\\/g, "/");
      if (!relativeSpecifier.startsWith(".")) {
        relativeSpecifier = `./${relativeSpecifier}`;
      }
      return `${prefix}${relativeSpecifier}${suffix}`;
    }
  );

  if (rewritten !== source) {
    writeFileSync(filePath, rewritten);
  }
};

for (const filePath of collectOutputFiles(distRoot)) {
  rewriteAliases(filePath);
}
