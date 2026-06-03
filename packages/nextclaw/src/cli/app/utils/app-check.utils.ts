import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AppCheckIssue, JsonRecord } from "@nextclaw-cli/cli/app/types/app-check.types.js";

export const PANEL_MANIFEST_FILE = "panel-app.json";
export const SERVICE_MANIFEST_FILE = "service-app.json";
export const VALID_AGENT_CAPABILITIES = new Set(["agent:send", "agent:generateObject"]);
export const VALID_SERVICE_ACTION_RISKS = new Set(["read", "write", "external", "dangerous"]);
export const KEBAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SERVICE_ACTION_ID_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(.+)$/;

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readOptionalString(record: JsonRecord, key: string): string | undefined {
  return typeof record[key] === "string" && record[key].trim()
    ? record[key].trim()
    : undefined;
}

export type StringCheckResult = {
  value?: string;
  issue?: AppCheckIssue;
};

export type StringArrayCheckResult = {
  values: string[];
  issue?: AppCheckIssue;
};

export type JsonObjectReadResult = {
  value: JsonRecord | null;
  issue?: AppCheckIssue;
};

export function readRequiredString(
  record: JsonRecord,
  key: string,
  prefix: string,
): StringCheckResult {
  const value = readOptionalString(record, key);
  if (!value) {
    return {
      issue: {
        severity: "error",
        code: `${prefix}.${key}.missing`,
        message: `${prefix}-app.json ${key} is required.`,
      },
    };
  }
  return { value };
}

export function getRecommendedStringIssue(
  record: JsonRecord,
  key: string,
  prefix: string,
): AppCheckIssue | undefined {
  if (!readOptionalString(record, key)) {
    return {
      severity: "warning",
      code: `${prefix}.${key}.missing`,
      message: `${prefix}-app.json ${key} is recommended.`,
    };
  }
  return undefined;
}

export function readStringArray(value: unknown, key: string): StringArrayCheckResult {
  if (value === undefined) {
    return { values: [] };
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return {
      values: [],
      issue: {
        severity: "error",
        code: `${key}.invalid`,
        message: `${key} must be a string array.`,
      },
    };
  }
  return { values: [...new Set(value.map((entry) => entry.trim()).filter(Boolean))] };
}

export async function getTargetDirectoryIssue(appPath: string): Promise<AppCheckIssue | undefined> {
  try {
    const targetStat = await stat(appPath);
    if (targetStat.isDirectory()) {
      return undefined;
    }
    return {
      severity: "error",
      code: "app.target.notDirectory",
      message: "App check target must be a directory.",
    };
  } catch {
    return {
      severity: "error",
      code: "app.target.missing",
      message: "App check target directory does not exist.",
    };
  }
}

export async function readJsonObject(filePath: string): Promise<JsonObjectReadResult> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (isRecord(parsed)) {
      return { value: parsed };
    }
    return {
      value: null,
      issue: {
        severity: "error",
        code: "manifest.notObject",
        message: `${path.basename(filePath)} must contain a JSON object.`,
      },
    };
  } catch (error) {
    return {
      value: null,
      issue: {
        severity: "error",
        code: "manifest.jsonInvalid",
        message: `${path.basename(filePath)} is not valid JSON.`,
        fixHint: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getMissingRelativeFileIssue(
  appPath: string,
  relativePath: string,
  code: string,
  message: string,
): Promise<AppCheckIssue | undefined> {
  const resolved = resolveRelativeFile(appPath, relativePath);
  if (!resolved || !(await fileExists(resolved))) {
    return {
      severity: "error",
      code,
      message: `${message}: ${relativePath}.`,
    };
  }
  return undefined;
}

export function resolveRelativeFile(appPath: string, relativePath: string): string | null {
  if (!isRelativeResource(relativePath)) {
    return null;
  }
  const resolved = path.resolve(appPath, relativePath);
  return resolved === appPath || resolved.startsWith(`${appPath}${path.sep}`)
    ? resolved
    : null;
}

export function isRelativeResource(value: string): boolean {
  return Boolean(value)
    && !value.startsWith("/")
    && !/^(?:[a-z]+:|#)/i.test(value);
}

export function extractHtmlAssetPaths(html: string): string[] {
  return [...html.matchAll(/<(?:img|link)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1] ?? "")
    .filter(isRelativeResource);
}

export function extractScriptSrcs(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1] ?? "");
}

export function inferWorkspaceRoot(appPath: string, containerName: string): string | null {
  const container = path.dirname(appPath);
  return path.basename(container) === containerName ? path.dirname(container) : null;
}

export function isNodeCommand(command: string): boolean {
  const name = path.basename(command).toLowerCase();
  return name === "node" || name === "node.exe";
}
