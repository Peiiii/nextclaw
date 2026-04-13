import fs from "node:fs";
import path from "node:path";

export const FILE_DIRECTORY_BASENAME_COLLISION_ALLOWLIST = [
  "packages/nextclaw-core/src/agent/skills.ts",
  "packages/nextclaw-core/src/agent/thinking.ts",
  "packages/nextclaw-openclaw-compat/src/plugins/loader.ts",
  "packages/nextclaw-server/src/ui/router.ts",
  "packages/nextclaw-ui/src/lib/i18n.ts",
  "packages/nextclaw/src/cli/commands/config.ts",
  "packages/nextclaw/src/cli/commands/cron.ts",
  "packages/nextclaw/src/cli/commands/diagnostics.ts",
  "packages/nextclaw/src/cli/commands/remote.ts",
  "packages/nextclaw/src/cli/commands/service.ts"
];

const normalizePathText = (value) => `${value ?? ""}`.trim().replaceAll("\\", "/").replace(/^\.\/+/, "");

const resolveFromRoot = (filePath, rootDir) => {
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  return path.resolve(rootDir, filePath);
};

export const createAllowedFilePathSet = (options = {}) => {
  const {
    allowFilePaths = FILE_DIRECTORY_BASENAME_COLLISION_ALLOWLIST,
    rootDir = process.cwd()
  } = options;

  return new Set(
    allowFilePaths
      .map((filePath) => normalizePathText(filePath))
      .filter(Boolean)
      .map((filePath) => resolveFromRoot(filePath, rootDir))
  );
};

export const findFileDirectoryBasenameCollision = (filePath, options = {}) => {
  const rootDir = options.rootDir ?? process.cwd();
  const allowedFilePaths = options.allowedFilePaths ?? createAllowedFilePathSet(options);
  const absoluteFilePath = resolveFromRoot(filePath, rootDir);
  if (allowedFilePaths.has(absoluteFilePath)) {
    return null;
  }

  const extension = path.extname(absoluteFilePath);
  if (!extension) {
    return null;
  }

  const basename = path.basename(absoluteFilePath, extension);
  if (!basename) {
    return null;
  }

  const absoluteDirectoryPath = path.join(path.dirname(absoluteFilePath), basename);
  let directoryStats = null;
  try {
    directoryStats = fs.statSync(absoluteDirectoryPath);
  } catch {
    return null;
  }

  if (!directoryStats.isDirectory()) {
    return null;
  }

  return {
    absoluteFilePath,
    absoluteDirectoryPath,
    filePath: normalizePathText(path.relative(rootDir, absoluteFilePath)),
    directoryPath: normalizePathText(path.relative(rootDir, absoluteDirectoryPath))
  };
};

export const collectFileDirectoryBasenameCollisions = (filePaths, options = {}) => {
  const rootDir = options.rootDir ?? process.cwd();
  const allowedFilePaths = createAllowedFilePathSet({
    ...options,
    rootDir
  });

  return filePaths
    .map((filePath) => findFileDirectoryBasenameCollision(filePath, {
      ...options,
      rootDir,
      allowedFilePaths
    }))
    .filter(Boolean)
    .sort((left, right) => left.filePath.localeCompare(right.filePath));
};
