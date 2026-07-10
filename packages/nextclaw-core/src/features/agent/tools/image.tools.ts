import { realpath, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { prepareImageForModel } from "@core/features/agent/utils/image-preparation.utils.js";
import { Tool, normalizeToolParams } from "./base.tools.js";

const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_IMAGE_FORMATS = "PNG, JPEG, WebP, GIF";

type ViewImageDetail = "high" | "original";

export type ViewImageToolOptions = {
  allowedDir?: string;
  maxBytes?: number;
  workingDir?: string;
};

export class ViewImageTool extends Tool {
  private readonly allowedDir: string | null;
  private readonly maxBytes: number;
  private readonly workingDir: string;

  constructor(options: ViewImageToolOptions = {}) {
    super();
    this.allowedDir = options.allowedDir ? resolve(options.allowedDir) : null;
    this.maxBytes = sanitizeMaxImageBytes(options.maxBytes);
    this.workingDir = resolve(options.workingDir ?? process.cwd());
  }

  get name(): string {
    return "view_image";
  }

  get description(): string {
    return "View a local image file from disk and send it to the model as visual input.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Local filesystem path to an image file."
        },
        detail: {
          type: "string",
          enum: ["high", "original"],
          description:
            "Image detail hint. Defaults to high. Use original when exact source bytes should be preserved."
        }
      },
      required: ["path"],
      additionalProperties: false
    };
  }

  execute = async (args: unknown): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const requestedPath = readNonEmptyString(params.path);
    if (!requestedPath) {
      throw new Error("view_image requires path.");
    }

    const detail = isViewImageDetail(params.detail) ? params.detail : "high";
    const imagePath = this.resolveImagePath(requestedPath);
    const metadata = await stat(imagePath).catch((error: unknown) => {
      throw new Error(`Unable to locate image at "${imagePath}": ${formatError(error)}`);
    });
    if (!metadata.isFile()) {
      throw new Error(`Image path "${imagePath}" is not a file.`);
    }
    if (metadata.size > this.maxBytes) {
      throw new Error(
        `Image at "${imagePath}" is too large: ${metadata.size} bytes exceeds ${this.maxBytes} bytes.`
      );
    }

    const readablePath = await this.resolveReadablePath(imagePath);
    const bytes = await readFile(readablePath);
    const mimeType = detectImageMimeType(bytes);
    if (!mimeType) {
      throw new Error(
        `Unsupported image format for "${readablePath}". Supported formats: ${SUPPORTED_IMAGE_FORMATS}.`
      );
    }
    const prepared = await prepareImageForModel(bytes, mimeType, detail, readablePath);

    return {
      ok: true,
      path: readablePath,
      mimeType: prepared.mimeType,
      sourceMimeType: mimeType,
      sizeBytes: bytes.byteLength,
      processedSizeBytes: prepared.bytes.byteLength,
      estimatedBudgetTokens: prepared.estimatedBudgetTokens,
      patchCount: prepared.patchCount,
      sourceWidth: prepared.sourceWidth,
      sourceHeight: prepared.sourceHeight,
      width: prepared.width,
      height: prepared.height,
      resized: prepared.resized,
      reencoded: prepared.reencoded,
      detail,
      image: {
        type: "image",
        mimeType: prepared.mimeType,
        detail,
        data: prepared.bytes.toString("base64")
      }
    };
  };

  private resolveImagePath = (requestedPath: string): string => {
    const imagePath = isAbsolute(requestedPath)
      ? resolve(requestedPath)
      : resolve(this.workingDir, requestedPath);
    if (this.allowedDir && !isPathInsideOrEqual(imagePath, this.allowedDir)) {
      throw new Error("Access denied: image path outside allowed directory.");
    }
    return imagePath;
  };

  private resolveReadablePath = async (imagePath: string): Promise<string> => {
    if (!this.allowedDir) {
      return imagePath;
    }
    const realAllowedDir = await realpath(this.allowedDir).catch((error: unknown) => {
      throw new Error(
        `Allowed image directory "${this.allowedDir}" is unavailable: ${formatError(error)}`
      );
    });
    const realImagePath = await realpath(imagePath);
    if (!isPathInsideOrEqual(realImagePath, realAllowedDir)) {
      throw new Error("Access denied: image path outside allowed directory.");
    }
    return realImagePath;
  };
}

function sanitizeMaxImageBytes(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_MAX_IMAGE_BYTES;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isViewImageDetail(value: unknown): value is ViewImageDetail {
  return value === "high" || value === "original";
}

function isPathInsideOrEqual(path: string, parent: string): boolean {
  const segment = relative(parent, path);
  return segment === "" || (!segment.startsWith("..") && !isAbsolute(segment));
}

function detectImageMimeType(bytes: Buffer): string | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const gifHeader = bytes.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return "image/gif";
  }
  return null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
