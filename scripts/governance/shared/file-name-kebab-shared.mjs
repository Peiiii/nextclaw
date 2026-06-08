import path from "node:path";

const kebabSegmentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const supportedExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sh"]);

const toPosixPath = (value) => value.split(path.sep).join(path.posix.sep);

export const isSupportedSourceFile = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const extension = path.posix.extname(normalizedPath);
  return supportedExtensions.has(extension) && !normalizedPath.endsWith(".d.ts");
};

export const isKebabSegment = (value) => kebabSegmentPattern.test(value);

export const toKebabSegment = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
  .replace(/[_\s]+/g, "-")
  .replace(/[^A-Za-z0-9-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase() || "unnamed";

export const suggestKebabFilePath = (filePath) => {
  const normalizedPath = toPosixPath(filePath);
  const directoryPath = path.posix.dirname(normalizedPath);
  const extension = path.posix.extname(normalizedPath);
  const stem = path.posix.basename(normalizedPath, extension);
  const nextStem = stem
    .split(".")
    .map((segment) => toKebabSegment(segment))
    .join(".");
  const nextBaseName = `${nextStem}${extension}`;

  if (directoryPath === "." || directoryPath === "") {
    return nextBaseName;
  }

  return path.posix.join(directoryPath, nextBaseName);
};

export const inspectKebabFilePath = (filePath) => {
  if (!isSupportedSourceFile(filePath)) {
    return null;
  }

  const normalizedPath = toPosixPath(filePath);
  const baseName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(baseName);
  const stem = baseName.slice(0, -extension.length);
  const segments = stem.split(".");
  const invalidSegment = segments.find((segment) => !isKebabSegment(segment));

  if (!invalidSegment) {
    return null;
  }

  return {
    filePath: normalizedPath,
    baseName,
    invalidSegment,
    suggestedPath: suggestKebabFilePath(normalizedPath),
    reason: `file name segment '${invalidSegment}' is not kebab-case`
  };
};
