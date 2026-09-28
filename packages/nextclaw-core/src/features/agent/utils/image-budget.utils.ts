const PROMPT_IMAGE_PATCH_SIZE = 32;
const HIGH_DETAIL_MAX_PATCHES = 2_500;
const ORIGINAL_DETAIL_MAX_PATCHES = 10_000;
const IMAGE_MIN_ESTIMATED_TOKENS = 256;

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
  const normalizedWidth = typeof width === "number" && Number.isFinite(width) && width > 0 ? Math.floor(width) : null;
  const normalizedHeight = typeof height === "number" && Number.isFinite(height) && height > 0 ? Math.floor(height) : null;
  if (normalizedWidth === null || normalizedHeight === null) return null;
  return Math.ceil(normalizedWidth / PROMPT_IMAGE_PATCH_SIZE) * Math.ceil(normalizedHeight / PROMPT_IMAGE_PATCH_SIZE);
}
