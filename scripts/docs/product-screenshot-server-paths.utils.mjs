import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const languageHints = new Map([
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.json', 'json'],
  ['.md', 'markdown'],
  ['.html', 'html'],
  ['.css', 'css']
]);

function readText(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function statOrNull(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function resolvePathFromRequest(rawPath, basePath, repoRoot) {
  const requestedPath = rawPath?.trim() || repoRoot;
  return path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(basePath?.trim() || repoRoot, requestedPath);
}

function inferServerPathKind(filePath) {
  return /\.mdx?$/iu.test(filePath) ? 'markdown' : 'text';
}

export function readServerPath({ basePath, path: requestedPath, repoRoot }) {
  const resolvedPath = resolvePathFromRequest(requestedPath, basePath, repoRoot);
  const text = readText(resolvedPath);
  const fileStat = statOrNull(resolvedPath);
  if (!text || !fileStat || !fileStat.isFile()) {
    return null;
  }
  return {
    requestedPath,
    resolvedPath,
    kind: inferServerPathKind(resolvedPath),
    sizeBytes: fileStat.size,
    truncated: false,
    text,
    languageHint: languageHints.get(path.extname(resolvedPath).toLowerCase()) || null
  };
}

export function browseServerPath({ basePath, includeFiles, path: requestedPath, repoRoot }) {
  const resolvedPath = resolvePathFromRequest(requestedPath, basePath, repoRoot);
  const fileStat = statOrNull(resolvedPath);
  if (!fileStat?.isDirectory()) {
    return null;
  }
  const entries = readdirSync(resolvedPath).map((name) => {
    const entryPath = path.join(resolvedPath, name);
    const entryStat = statOrNull(entryPath);
    return {
      name,
      path: entryPath,
      kind: entryStat?.isDirectory() ? 'directory' : 'file',
      sizeBytes: entryStat?.size ?? 0,
      modifiedAt: entryStat?.mtime.toISOString() ?? new Date(0).toISOString()
    };
  }).filter((entry) => includeFiles || entry.kind === 'directory');
  return {
    currentPath: resolvedPath,
    parentPath: path.dirname(resolvedPath),
    homePath: repoRoot,
    breadcrumbs: resolvedPath.split(path.sep).filter(Boolean).map((label, index, parts) => ({
      label,
      path: `${path.sep}${parts.slice(0, index + 1).join(path.sep)}`
    })),
    entries
  };
}

function decodeServerContentPath(pathname) {
  const prefix = '/api/server-paths/content/__abs__/';
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const segments = pathname.slice(prefix.length).split('/').filter(Boolean).map(decodeURIComponent);
  return `${path.sep}${segments.join(path.sep)}`;
}

export function readServerContent(pathname) {
  const filePath = decodeServerContentPath(pathname);
  return filePath ? readText(filePath) : null;
}
