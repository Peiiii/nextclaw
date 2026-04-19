import { resolve } from "node:path";
import {
  buildAssetContentPath,
  type LocalAssetStore,
  type StoredAssetRecord,
} from "@nextclaw/ncp-agent-runtime";
import type { NcpTool } from "@nextclaw/ncp";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalBase64Bytes(value: unknown): Uint8Array | null {
  const base64 = readOptionalString(value);
  if (!base64) {
    return null;
  }
  try {
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

function toAssetPayload(record: StoredAssetRecord, contentBasePath: string) {
  return {
    uri: record.uri,
    name: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
    url: buildAssetContentPath({
      basePath: contentBasePath,
      assetUri: record.uri,
    }),
  };
}

class AssetPutTool implements NcpTool {
  readonly name = "asset_put";
  readonly description =
    "Put a normal file path or base64 bytes into the managed asset store.";
  readonly parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Existing local file path to put into the asset store.",
      },
      bytesBase64: {
        type: "string",
        description: "Base64 file bytes. Use together with fileName when no source path exists.",
      },
      fileName: {
        type: "string",
        description: "Optional asset file name override. Required when using bytesBase64.",
      },
      mimeType: {
        type: "string",
        description: "Optional mime type override.",
      },
    },
    additionalProperties: false,
  };

  constructor(
    private readonly assetStore: LocalAssetStore,
    private readonly contentBasePath: string,
  ) {}

  validateArgs = (args: Record<string, unknown>): string[] => {
    const path = readOptionalString(args.path);
    const bytesBase64 = readOptionalString(args.bytesBase64);
    const fileName = readOptionalString(args.fileName);

    if (path && bytesBase64) {
      return ["Provide either path, or bytesBase64 + fileName, not both."];
    }
    if (path) {
      return [];
    }
    if (bytesBase64) {
      return fileName ? [] : ["fileName is required when using bytesBase64."];
    }
    return ["Provide either path, or bytesBase64 + fileName."];
  };

  execute = async (args: unknown): Promise<unknown> => {
    const path = readOptionalString((args as { path?: unknown } | null)?.path);
    const fileName = readOptionalString((args as { fileName?: unknown } | null)?.fileName);
    const mimeType = readOptionalString((args as { mimeType?: unknown } | null)?.mimeType);
    const bytes = readOptionalBase64Bytes((args as { bytesBase64?: unknown } | null)?.bytesBase64);

    if (path) {
      const record = await this.assetStore.putPath({
        path,
        fileName: fileName ?? undefined,
        mimeType,
      });
      return {
        ok: true,
        asset: toAssetPayload(record, this.contentBasePath),
      };
    }

    if (bytes && fileName) {
      const record = await this.assetStore.putBytes({
        fileName,
        mimeType,
        bytes,
      });
      return {
        ok: true,
        asset: toAssetPayload(record, this.contentBasePath),
      };
    }

    throw new Error("asset_put received invalid arguments after validation.");
  };
}

class AssetExportTool implements NcpTool {
  readonly name = "asset_export";
  readonly description =
    "Export a managed asset to a normal file path so it can be processed like any ordinary file.";
  readonly parameters = {
    type: "object",
    properties: {
      assetUri: {
        type: "string",
        description: "Managed asset URI to export.",
      },
      targetPath: {
        type: "string",
        description: "Destination file path.",
      },
    },
    required: ["assetUri", "targetPath"],
    additionalProperties: false,
  };

  constructor(private readonly assetStore: LocalAssetStore) {}

  execute = async (args: unknown): Promise<unknown> => {
    const assetUri = readOptionalString((args as { assetUri?: unknown } | null)?.assetUri);
    const targetPath = readOptionalString((args as { targetPath?: unknown } | null)?.targetPath);
    if (!assetUri || !targetPath) {
      throw new Error("asset_export requires assetUri and targetPath.");
    }
    const exportedPath = await this.assetStore.export({ uri: assetUri }, resolve(targetPath));
    return {
      ok: true,
      assetUri,
      exportedPath,
    };
  };
}

class AssetStatTool implements NcpTool {
  readonly name = "asset_stat";
  readonly description = "Read managed asset metadata.";
  readonly parameters = {
    type: "object",
    properties: {
      assetUri: {
        type: "string",
        description: "Managed asset URI to inspect.",
      },
    },
    required: ["assetUri"],
    additionalProperties: false,
  };

  constructor(
    private readonly assetStore: LocalAssetStore,
    private readonly contentBasePath: string,
  ) {}

  execute = async (args: unknown): Promise<unknown> => {
    const assetUri = readOptionalString((args as { assetUri?: unknown } | null)?.assetUri);
    if (!assetUri) {
      throw new Error("asset_stat requires assetUri.");
    }
    const record = await this.assetStore.statRecord(assetUri);
    if (!record) {
      return {
        ok: false,
        error: {
          code: "not_found",
          message: `Asset not found: ${assetUri}`,
        },
      };
    }
    return {
      ok: true,
      asset: toAssetPayload(record, this.contentBasePath),
    };
  };
}

export function createAssetTools(params: {
  assetStore: LocalAssetStore;
  contentBasePath?: string;
}): NcpTool[] {
  const { assetStore } = params;
  const contentBasePath = params.contentBasePath ?? "/api/ncp/assets/content";
  return [
    new AssetPutTool(assetStore, contentBasePath),
    new AssetExportTool(assetStore),
    new AssetStatTool(assetStore, contentBasePath),
  ];
}
