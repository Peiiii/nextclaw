import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { Dirent, Stats } from "node:fs";
import { PanelAppError } from "@kernel/types/panel-app.types.js";
import {
  parsePanelAppFolderManifest,
  type PanelAppManifest,
} from "@kernel/utils/panel-app-manifest.utils.js";

export const PANEL_APP_FILE_SUFFIX = ".panel.html";
export const PANEL_APP_DIR_SUFFIX = ".panel";
export const PANEL_APP_FOLDER_MANIFEST_FILE_NAME = "panel-app.json";

export type PanelAppSourceKind = "single-file" | "folder";

export type PanelAppSource = {
  kind: PanelAppSourceKind;
  sourceName: string;
  sourcePath: string;
  entryPath: string;
  manifest?: PanelAppManifest;
  sourceStat: Stats;
};

export type PanelAppAssetContentType =
  | "application/javascript; charset=utf-8"
  | "application/json; charset=utf-8"
  | "application/octet-stream"
  | "image/png"
  | "image/svg+xml; charset=utf-8"
  | "image/webp"
  | "text/css; charset=utf-8"
  | "text/plain; charset=utf-8";

export type PanelAppAsset = {
  content: Buffer;
  contentType: PanelAppAssetContentType;
};

export function isPanelAppSourceEntry(entry: Dirent): boolean {
  return (
    (entry.isFile() && isPanelAppFileName(entry.name)) ||
    (entry.isDirectory() && isPanelAppDirName(entry.name))
  );
}

export function isPanelAppFileName(fileName: string): boolean {
  return hasSafeBaseName(fileName) && fileName.endsWith(PANEL_APP_FILE_SUFFIX);
}

export function isPanelAppDirName(dirName: string): boolean {
  return hasSafeBaseName(dirName) && dirName.endsWith(PANEL_APP_DIR_SUFFIX);
}

export function toPanelAppTitle(sourceName: string): string {
  return (
    sourceName
      .replace(new RegExp(`${escapeRegExp(PANEL_APP_FILE_SUFFIX)}$`), "")
      .replace(new RegExp(`${escapeRegExp(PANEL_APP_DIR_SUFFIX)}$`), "")
      .replace(/[-_]+/g, " ")
      .trim() || sourceName
  );
}

export function encodePanelAppId(sourceName: string): string {
  return Buffer.from(sourceName, "utf8").toString("base64url");
}

export function decodePanelAppId(id: string): string {
  const normalizedId = id.trim();
  if (!normalizedId) {
    throw new PanelAppError("PANEL_APP_INVALID_ID", "panel app id is required");
  }
  let sourceName = "";
  try {
    sourceName = Buffer.from(normalizedId, "base64url").toString("utf8");
  } catch {
    throw new PanelAppError("PANEL_APP_INVALID_ID", "invalid panel app id");
  }
  if (
    encodePanelAppId(sourceName) !== normalizedId ||
    (!isPanelAppFileName(sourceName) && !isPanelAppDirName(sourceName))
  ) {
    throw new PanelAppError("PANEL_APP_INVALID_ID", "invalid panel app id");
  }
  return sourceName;
}

export async function readPanelAppFolderManifest(
  dirPath: string,
  dirName: string,
): Promise<PanelAppManifest & { id: string; title: string; entry: string }> {
  const raw = await readFile(join(dirPath, PANEL_APP_FOLDER_MANIFEST_FILE_NAME), "utf8");
  const manifest = parsePanelAppFolderManifest(raw);
  const expectedId = dirName.slice(0, -PANEL_APP_DIR_SUFFIX.length);
  if (manifest.id && manifest.id !== expectedId) {
    throw new PanelAppError(
      "PANEL_APP_MANIFEST_INVALID",
      "panel app manifest id must match the directory name",
    );
  }
  return { ...manifest, id: expectedId };
}

export function resolvePanelAppRelativePath(rootPath: string, relativePath: string): string {
  if (!relativePath.trim() || relativePath.includes("\0") || isAbsolute(relativePath)) {
    throw new PanelAppError("PANEL_APP_INVALID_ASSET_PATH", "invalid panel app asset path");
  }
  const normalizedPath = normalize(relativePath);
  if (normalizedPath === "." || normalizedPath.startsWith("..")) {
    throw new PanelAppError("PANEL_APP_INVALID_ASSET_PATH", "invalid panel app asset path");
  }
  const resolvedPath = resolve(rootPath, normalizedPath);
  const resolvedRoot = resolve(rootPath);
  const pathFromRoot = relative(resolvedRoot, resolvedPath);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    throw new PanelAppError("PANEL_APP_INVALID_ASSET_PATH", "invalid panel app asset path");
  }
  return resolvedPath;
}

export function resolvePanelAppAssetContentType(path: string): PanelAppAssetContentType {
  switch (extname(path).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".webp":
      return "image/webp";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function resolvePanelAppIconUrl(
  id: string,
  icon: string | undefined,
): string | undefined {
  if (!icon) {
    return undefined;
  }
  if (
    icon.startsWith("data:image/") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("/") ||
    isLikelyTextIcon(icon)
  ) {
    return icon;
  }
  return `/api/panel-apps/${encodeURIComponent(id)}/assets/${encodePanelAppAssetPath(icon)}`;
}

export function injectPanelAppAssetBase(html: string, baseHref: string): string {
  const base = `<base href="${baseHref}">`;
  const htmlWithBase = (() => {
    if (/<base\b/i.test(html)) {
      return html;
    }
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, (head) => `${head}${base}`);
    }
    return `${base}${html}`;
  })();
  return injectLocalScriptCrossOrigin(htmlWithBase);
}

function injectLocalScriptCrossOrigin(html: string): string {
  return html.replace(/<script\b(?=[^>]*\bsrc\s*=)(?![^>]*\bcrossorigin\b)[^>]*>/gi, (tag) => {
    const src = extractScriptSrc(tag);
    if (!src || !isLocalScriptSrc(src)) {
      return tag;
    }
    return `${tag.slice(0, -1)} crossorigin="anonymous">`;
  });
}

function extractScriptSrc(tag: string): string | undefined {
  const match = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function isLocalScriptSrc(src: string): boolean {
  const value = src.trim();
  if (!value || value.startsWith("//")) {
    return false;
  }
  return !/^(?:https?|data|blob|javascript):/i.test(value);
}

function encodePanelAppAssetPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function hasSafeBaseName(name: string): boolean {
  return !name.includes("/") && !name.includes("\\") && !name.includes("\0");
}

function isLikelyTextIcon(icon: string): boolean {
  return !icon.includes("/") && !icon.includes(".") && icon.length <= 4;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
