import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { Config } from "./schema.js";
import { expandHome } from "../utils/helpers.js";

export function materializeAgentAvatar(params: {
  avatar?: string;
  homeDirectory: string;
  agentId: string;
  displayName: string;
}): string {
  const { avatar: rawAvatar, homeDirectory, agentId, displayName } = params;
  const avatar = normalizeOptionalString(rawAvatar);
  mkdirSync(homeDirectory, { recursive: true });
  if (!avatar) {
    const fileName = "avatar.svg";
    writeFileSync(join(homeDirectory, fileName), buildDefaultAgentAvatarSvg(agentId, displayName), "utf-8");
    return `home://${fileName}`;
  }
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }
  return copyLocalAvatarToHome(homeDirectory, avatar);
}

export function resolveAgentAvatarHomePath(params: {
  homeDirectory: string;
  avatarRef: string;
}): string {
  const normalizedRef = normalizeOptionalString(params.avatarRef);
  if (!normalizedRef?.startsWith("home://")) {
    throw new Error("avatar ref must use home://");
  }
  const relativePath = normalizedRef.slice("home://".length).trim();
  if (!relativePath) {
    throw new Error("avatar ref must not be empty");
  }
  const targetPath = resolve(params.homeDirectory, relativePath);
  const normalizedHome = normalize(resolve(params.homeDirectory));
  const normalizedTarget = normalize(targetPath);
  if (
    normalizedTarget !== normalizedHome &&
    !normalizedTarget.startsWith(`${normalizedHome}/`) &&
    !normalizedTarget.startsWith(`${normalizedHome}\\`)
  ) {
    throw new Error("avatar ref escapes agent home directory");
  }
  return targetPath;
}

export function readAgentAvatarContent(params: {
  config: Config;
  agentId: string;
  resolveAssetPath: (config: Config, agentId: string) => string | null;
}): { bytes: Uint8Array; mimeType: string } | null {
  const assetPath = params.resolveAssetPath(params.config, params.agentId);
  if (!assetPath || !existsSync(assetPath)) {
    return null;
  }
  const bytes = readFileSync(assetPath);
  return {
    bytes,
    mimeType: guessImageMimeType(assetPath)
  };
}

export function guessImageMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".svg") {
    return "image/svg+xml";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  return "application/octet-stream";
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function copyLocalAvatarToHome(homeDirectory: string, avatarPath: string): string {
  const sourcePath = resolve(expandHome(avatarPath));
  if (!existsSync(sourcePath)) {
    throw new Error(`avatar file not found: ${avatarPath}`);
  }
  if (!statSync(sourcePath).isFile()) {
    throw new Error(`avatar path is not a file: ${avatarPath}`);
  }
  const ext = extname(sourcePath).toLowerCase() || ".png";
  const fileName = `avatar${ext}`;
  copyFileSync(sourcePath, join(homeDirectory, fileName));
  return `home://${fileName}`;
}

function buildDefaultAgentAvatarSvg(agentId: string, displayName: string): string {
  const palette = [
    ["#F59E0B", "#B45309"],
    ["#10B981", "#047857"],
    ["#3B82F6", "#1D4ED8"],
    ["#EF4444", "#B91C1C"],
    ["#8B5CF6", "#6D28D9"],
    ["#14B8A6", "#0F766E"]
  ] as const;
  const [bg, fg] = palette[Math.abs(hashText(agentId)) % palette.length] ?? palette[0];
  const letter = (displayName || agentId).trim().slice(0, 1).toUpperCase() || "A";
  return [
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\" role=\"img\" aria-label=\"avatar\">",
    `  <rect width=\"256\" height=\"256\" rx=\"64\" fill=\"${bg}\" />`,
    `  <text x=\"128\" y=\"146\" text-anchor=\"middle\" font-family=\"Arial, sans-serif\" font-size=\"104\" font-weight=\"700\" fill=\"${fg}\">${escapeXml(letter)}</text>`,
    "</svg>"
  ].join("\n");
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
