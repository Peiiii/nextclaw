import sharp from "sharp";

const HIGH_DETAIL_MAX_DIMENSION = 2048;
const HIGH_DETAIL_MAX_BASE64_CHARS = 5 * 1024 * 1024;
const PROMPT_IMAGE_PATCH_SIZE = 32;
const HIGH_DETAIL_MAX_PATCHES = 2_500;
const ORIGINAL_DETAIL_MAX_PATCHES = 10_000;
const IMAGE_MIN_ESTIMATED_TOKENS = 256;
const HIGH_DETAIL_JPEG_QUALITIES = [85, 75, 60, 45, 30] as const;
const HIGH_DETAIL_WEBP_QUALITIES = [85, 75, 60, 45, 30] as const;

export type ImagePreparationDetail = "high" | "original";

export type PreparedImagePayload = {
  bytes: Buffer;
  estimatedBudgetTokens: number;
  height: number | null;
  mimeType: string;
  patchCount: number | null;
  reencoded: boolean;
  resized: boolean;
  sourceHeight: number | null;
  sourceWidth: number | null;
  width: number | null;
};

type ImageCandidate = {
  bytes: Buffer;
  height: number | null;
  mimeType: string;
  width: number | null;
};

export async function prepareImageForModel(
  bytes: Buffer,
  mimeType: string,
  detail: ImagePreparationDetail,
  path: string
): Promise<PreparedImagePayload> {
  const source = await createImageCandidate(bytes, mimeType).catch((error: unknown) => {
    throw new Error(`Unable to decode image "${path}": ${formatError(error)}`);
  });
  if (detail === "original" || !needsHighDetailPreparation(source)) {
    return toPreparedImagePayload(source, source, detail, false, false);
  }

  const candidates = await createHighDetailCandidates(source, path);
  const boundedCandidate = candidates.find(isHighDetailCandidateWithinLimits);
  if (boundedCandidate) {
    return toPreparedImagePayload(
      source,
      boundedCandidate,
      detail,
      dimensionsChanged(source, boundedCandidate),
      !boundedCandidate.bytes.equals(bytes)
    );
  }

  const smallest = candidates.reduce((best, candidate) =>
    candidate.bytes.byteLength < best.bytes.byteLength ? candidate : best
  );
  throw new Error(
    `Unable to prepare image "${path}" within the high-detail payload limit: ` +
      `${estimateBase64Chars(smallest.bytes.byteLength)} base64 chars exceeds ` +
      `${HIGH_DETAIL_MAX_BASE64_CHARS}, or ${formatPatchCount(smallest)} exceeds ` +
      `${HIGH_DETAIL_MAX_PATCHES} patches. Use detail "original" only when exact source bytes are required.`
  );
}

export function estimateImageBudgetTokens(params: {
  detail?: unknown;
  height?: unknown;
  width?: unknown;
} = {}): number {
  const detail = params.detail === "original" ? "original" : "high";
  const maxPatches = detail === "original" ? ORIGINAL_DETAIL_MAX_PATCHES : HIGH_DETAIL_MAX_PATCHES;
  const patchCount = calculateImagePatchCount(params.width, params.height);
  return Math.max(IMAGE_MIN_ESTIMATED_TOKENS, patchCount === null ? maxPatches : Math.min(patchCount, maxPatches));
}

export function calculateImagePatchCount(width: unknown, height: unknown): number | null {
  const normalizedWidth = readDimension(width);
  const normalizedHeight = readDimension(height);
  if (normalizedWidth === null || normalizedHeight === null) {
    return null;
  }
  return (
    Math.ceil(normalizedWidth / PROMPT_IMAGE_PATCH_SIZE) *
    Math.ceil(normalizedHeight / PROMPT_IMAGE_PATCH_SIZE)
  );
}

function needsHighDetailPreparation(candidate: ImageCandidate): boolean {
  return (
    estimateBase64Chars(candidate.bytes.byteLength) > HIGH_DETAIL_MAX_BASE64_CHARS ||
    dimensionExceedsLimit(candidate.width) ||
    dimensionExceedsLimit(candidate.height) ||
    patchCountExceedsHighDetailLimit(candidate)
  );
}

async function createHighDetailCandidates(source: ImageCandidate, path: string): Promise<ImageCandidate[]> {
  const resizeTarget = resolveHighDetailResizeTarget(source);
  const pipeline = sharp(source.bytes, { animated: false }).rotate();
  if (resizeTarget) {
    pipeline.resize({
      fit: "inside",
      height: resizeTarget.height,
      width: resizeTarget.width,
      withoutEnlargement: true
    });
  }
  const candidates: ImageCandidate[] = [];

  if (source.mimeType === "image/png") {
    const pngBytes = await pipeline.clone().png({ adaptiveFiltering: true, compressionLevel: 9 }).toBuffer();
    candidates.push(await createImageCandidate(pngBytes, "image/png"));
  }

  if (source.mimeType !== "image/jpeg") {
    for (const quality of HIGH_DETAIL_WEBP_QUALITIES) {
      const webpBytes = await pipeline.clone().webp({ quality }).toBuffer();
      candidates.push(await createImageCandidate(webpBytes, "image/webp"));
    }
  }

  for (const quality of HIGH_DETAIL_JPEG_QUALITIES) {
    const jpegBytes = await pipeline
      .clone()
      .flatten({ background: { b: 255, g: 255, r: 255 } })
      .jpeg({ mozjpeg: true, quality })
      .toBuffer();
    candidates.push(await createImageCandidate(jpegBytes, "image/jpeg"));
  }

  if (candidates.length === 0) {
    throw new Error(`Unable to prepare image "${path}" for high-detail model input.`);
  }
  return candidates;
}

async function createImageCandidate(bytes: Buffer, mimeType: string): Promise<ImageCandidate> {
  const metadata = await sharp(bytes, { animated: false }).metadata();
  return {
    bytes,
    height: readDimension(metadata.height),
    mimeType,
    width: readDimension(metadata.width)
  };
}

function toPreparedImagePayload(
  source: ImageCandidate,
  candidate: ImageCandidate,
  detail: ImagePreparationDetail,
  resized: boolean,
  reencoded: boolean
): PreparedImagePayload {
  const patchCount = calculateImagePatchCount(candidate.width, candidate.height);
  return {
    bytes: candidate.bytes,
    estimatedBudgetTokens: estimateImageBudgetTokens({
      detail,
      height: candidate.height,
      width: candidate.width
    }),
    height: candidate.height,
    mimeType: candidate.mimeType,
    patchCount,
    reencoded,
    resized,
    sourceHeight: source.height,
    sourceWidth: source.width,
    width: candidate.width
  };
}

function dimensionExceedsLimit(value: number | null): boolean {
  return value !== null && value > HIGH_DETAIL_MAX_DIMENSION;
}

function patchCountExceedsHighDetailLimit(candidate: ImageCandidate): boolean {
  const patchCount = calculateImagePatchCount(candidate.width, candidate.height);
  return patchCount !== null && patchCount > HIGH_DETAIL_MAX_PATCHES;
}

function isHighDetailCandidateWithinLimits(candidate: ImageCandidate): boolean {
  return (
    estimateBase64Chars(candidate.bytes.byteLength) <= HIGH_DETAIL_MAX_BASE64_CHARS &&
    !dimensionExceedsLimit(candidate.width) &&
    !dimensionExceedsLimit(candidate.height) &&
    !patchCountExceedsHighDetailLimit(candidate)
  );
}

function dimensionsChanged(source: ImageCandidate, candidate: ImageCandidate): boolean {
  return source.width !== candidate.width || source.height !== candidate.height;
}

function resolveHighDetailResizeTarget(candidate: ImageCandidate): { height: number; width: number } | null {
  const sourceWidth = readDimension(candidate.width);
  const sourceHeight = readDimension(candidate.height);
  if (sourceWidth === null || sourceHeight === null) {
    return null;
  }

  let width = sourceWidth;
  let height = sourceHeight;
  const dimensionScale = Math.min(
    1,
    HIGH_DETAIL_MAX_DIMENSION / sourceWidth,
    HIGH_DETAIL_MAX_DIMENSION / sourceHeight
  );
  if (dimensionScale < 1) {
    width = Math.max(1, Math.floor(sourceWidth * dimensionScale));
    height = Math.max(1, Math.floor(sourceHeight * dimensionScale));
  }

  const patchCount = calculateImagePatchCount(width, height);
  if (patchCount !== null && patchCount > HIGH_DETAIL_MAX_PATCHES) {
    const patchScale = Math.sqrt(HIGH_DETAIL_MAX_PATCHES / patchCount);
    width = Math.max(1, Math.floor(width * patchScale));
    height = Math.max(1, Math.floor(height * patchScale));
    while (patchCountExceedsDimensions(width, height) && (width > 1 || height > 1)) {
      if (width >= height && width > 1) {
        width = Math.max(1, width - PROMPT_IMAGE_PATCH_SIZE);
      } else {
        height = Math.max(1, height - PROMPT_IMAGE_PATCH_SIZE);
      }
    }
  }

  return width === sourceWidth && height === sourceHeight ? null : { height, width };
}

function patchCountExceedsDimensions(width: number, height: number): boolean {
  const patchCount = calculateImagePatchCount(width, height);
  return patchCount !== null && patchCount > HIGH_DETAIL_MAX_PATCHES;
}

function readDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function estimateBase64Chars(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

function formatPatchCount(candidate: ImageCandidate): string {
  const patchCount = calculateImagePatchCount(candidate.width, candidate.height);
  return patchCount === null ? "an unknown patch count" : `${patchCount}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
