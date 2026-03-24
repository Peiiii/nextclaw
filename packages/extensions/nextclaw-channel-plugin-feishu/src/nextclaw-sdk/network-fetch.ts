import crypto from "node:crypto";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

function sanitizePrefix(prefix: string): string {
  const normalized = prefix.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "tmp";
}

function sanitizeFileName(fileName: string): string {
  const normalized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "download.bin";
}

function resolveTempRoot(tmpDir?: string): string {
  return tmpDir ?? process.env.NEXTCLAW_TMP_DIR?.trim() ?? os.tmpdir();
}

export async function withTempDownloadPath<T>(
  params: {
    prefix: string;
    fileName?: string;
    tmpDir?: string;
  },
  fn: (tmpPath: string) => Promise<T>,
): Promise<T> {
  const root = resolveTempRoot(params.tmpDir);
  const dir = await mkdtemp(path.join(root, `${sanitizePrefix(params.prefix)}-`));
  const tempPath = path.join(dir, sanitizeFileName(params.fileName ?? "download.bin"));
  try {
    return await fn(tempPath);
  } finally {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {}
  }
}

export async function fetchWithSsrFGuard(params: {
  url: string;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  init?: RequestInit;
  timeoutMs?: number;
  signal?: AbortSignal;
  policy?: {
    allowedHostnames?: string[];
  };
  auditContext?: string;
}): Promise<{
  response: Response;
  finalUrl: string;
  release: () => Promise<void>;
}> {
  const fetcher = params.fetchImpl ?? globalThis.fetch;
  if (!fetcher) {
    throw new Error("fetch is not available");
  }
  const parsed = new URL(params.url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid URL: must be http or https");
  }
  const allowedHostnames = params.policy?.allowedHostnames?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  if (allowedHostnames.length > 0 && !allowedHostnames.includes(parsed.hostname)) {
    throw new Error(
      `${params.auditContext ?? "guarded-fetch"} blocked hostname "${parsed.hostname}"`,
    );
  }

  const controller = new AbortController();
  const timeoutId =
    params.timeoutMs && params.timeoutMs > 0
      ? setTimeout(() => controller.abort(), params.timeoutMs)
      : undefined;
  const relay = () => controller.abort();
  if (params.signal) {
    if (params.signal.aborted) {
      controller.abort();
    } else {
      params.signal.addEventListener("abort", relay, { once: true });
    }
  }

  const response = await fetcher(parsed.toString(), {
    ...(params.init ?? {}),
    signal: controller.signal,
  });
  const finalUrl = response.url || parsed.toString();
  const finalHostname = new URL(finalUrl).hostname;
  if (allowedHostnames.length > 0 && !allowedHostnames.includes(finalHostname)) {
    clearTimeout(timeoutId);
    if (params.signal) {
      params.signal.removeEventListener("abort", relay);
    }
    throw new Error(
      `${params.auditContext ?? "guarded-fetch"} blocked redirected hostname "${finalHostname}"`,
    );
  }

  return {
    response,
    finalUrl,
    release: async () => {
      clearTimeout(timeoutId);
      if (params.signal) {
        params.signal.removeEventListener("abort", relay);
      }
    },
  };
}

export function buildRandomTempFilePath(params: {
  prefix: string;
  extension?: string;
  tmpDir?: string;
  now?: number;
  uuid?: string;
}): string {
  const prefix = sanitizePrefix(params.prefix);
  const extension = params.extension
    ? `.${params.extension.replace(/^\.+/, "").replace(/[^a-zA-Z0-9._-]+/g, "")}`
    : "";
  const now =
    typeof params.now === "number" && Number.isFinite(params.now)
      ? Math.trunc(params.now)
      : Date.now();
  const uuid = params.uuid?.trim() || crypto.randomUUID();
  return path.join(resolveTempRoot(params.tmpDir), `${prefix}-${now}-${uuid}${extension}`);
}
