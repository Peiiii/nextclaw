import { readFile } from "node:fs/promises";
import type { Context } from "hono";
import type { UiNcpAssetPutView, UiNcpAssetView } from "../types.js";
import { err, ok } from "./response.js";
import type { UiRouterOptions } from "./types.js";

const ASSET_CONTENT_BASE_PATH = "/api/ncp/assets/content";

function buildAssetContentUrl(assetUri: string): string {
  const query = new URLSearchParams({ uri: assetUri });
  return `${ASSET_CONTENT_BASE_PATH}?${query.toString()}`;
}

function encodeContentDispositionFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(/\*/g, "%2A");
}

function inferMimeTypeFromFileName(fileName: string): string | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".ogg")) return "audio/ogg";
  if (normalized.endsWith(".opus")) return "audio/opus";
  if (normalized.endsWith(".flac")) return "audio/flac";
  if (normalized.endsWith(".aac")) return "audio/aac";
  if (normalized.endsWith(".weba")) return "audio/webm";
  if (normalized.endsWith(".mp4") || normalized.endsWith(".m4v")) return "video/mp4";
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".webm")) return "video/webm";
  if (normalized.endsWith(".mkv")) return "video/x-matroska";
  if (normalized.endsWith(".avi")) return "video/x-msvideo";
  if (normalized.endsWith(".wmv")) return "video/x-ms-wmv";
  return null;
}

function resolveResponseMimeType(fileName: string, mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.length > 0 && normalized !== "application/octet-stream") {
    return normalized;
  }
  return inferMimeTypeFromFileName(fileName) ?? "application/octet-stream";
}

function toAssetView(record: {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): UiNcpAssetView {
  return {
    id: record.id,
    name: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    assetUri: record.uri,
    url: buildAssetContentUrl(record.uri),
  };
}

export class NcpAssetRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly putAssets = async (c: Context) => {
    const assetApi = this.options.ncpAgent?.assetApi;
    if (!assetApi) {
      return c.json(err("NOT_AVAILABLE", "ncp asset api unavailable"), 503);
    }

    let formData: FormData;
    try {
      formData = await c.req.raw.formData();
    } catch {
      return c.json(err("INVALID_BODY", "invalid multipart body"), 400);
    }

    const files = Array.from(formData.values()).reduce<
      Array<{
        name: string;
        type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
      }>
    >((result, value) => {
      if (typeof value !== "string") {
        result.push(value as {
          name: string;
          type: string;
          arrayBuffer: () => Promise<ArrayBuffer>;
        });
      }
      return result;
    }, []);
    if (files.length === 0) {
      return c.json(err("INVALID_BODY", "no files provided"), 400);
    }

    const assets: UiNcpAssetView[] = [];
    for (const file of files) {
      const record = await assetApi.put({
        fileName: file.name,
        mimeType: file.type || null,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      assets.push(toAssetView(record));
    }

    const payload: UiNcpAssetPutView = { assets };
    return c.json(ok(payload));
  };

  readonly getAssetContent = async (c: Context): Promise<Response> => {
    const assetApi = this.options.ncpAgent?.assetApi;
    if (!assetApi) {
      return c.json(err("NOT_AVAILABLE", "ncp asset api unavailable"), 503);
    }

    const uri = c.req.query("uri")?.trim();
    if (!uri) {
      return c.json(err("INVALID_URI", "asset uri is required"), 400);
    }

    const record = await assetApi.stat(uri);
    const contentPath = assetApi.resolveContentPath(uri);
    if (!record || !contentPath) {
      return c.json(err("NOT_FOUND", `asset not found: ${uri}`), 404);
    }

    const body = await readFile(contentPath);
    return new Response(body, {
      headers: {
        "content-type": resolveResponseMimeType(
          record.fileName,
          record.mimeType || "application/octet-stream",
        ),
        "content-disposition": `inline; filename*=UTF-8''${encodeContentDispositionFileName(record.fileName)}`,
      },
    });
  };
}
