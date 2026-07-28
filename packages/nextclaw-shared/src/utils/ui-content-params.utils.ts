import type {
  UiContentParams,
  UiContentParamValue,
} from "../types/ui-show-content.types.js";

export const UI_CONTENT_PARAMS_HOST_CONTRACT = {
  bootstrapQueryParam: "nextclawContentParams",
  bootstrapQueryValue: "1",
  maxDepth: 32,
  maxSerializedBytes: 64 * 1024,
  windowNamePrefix: "nextclaw:content-params:v1:",
} as const;

export class UiContentParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiContentParamsError";
  }
}

function assertJsonValue(
  value: unknown,
  depth: number,
  ancestors: readonly object[],
): asserts value is UiContentParamValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new UiContentParamsError(
        "params must contain only finite numbers.",
      );
    }
    return;
  }
  if (typeof value !== "object") {
    throw new UiContentParamsError("params must contain only JSON values.");
  }
  if (depth >= UI_CONTENT_PARAMS_HOST_CONTRACT.maxDepth) {
    throw new UiContentParamsError(
      `params must not exceed ${UI_CONTENT_PARAMS_HOST_CONTRACT.maxDepth} nested levels.`,
    );
  }
  if (ancestors.includes(value)) {
    throw new UiContentParamsError(
      "params must not contain circular references.",
    );
  }
  const nextAncestors = [...ancestors, value];
  if (Array.isArray(value)) {
    for (const item of value) {
      assertJsonValue(item, depth + 1, nextAncestors);
    }
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new UiContentParamsError("params must contain only plain objects.");
  }
  for (const item of Object.values(value)) {
    assertJsonValue(item, depth + 1, nextAncestors);
  }
}

export function readUiContentParams(
  value: unknown,
): UiContentParams | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UiContentParamsError("params must be a JSON object.");
  }
  assertJsonValue(value, 0, []);
  const serialized = JSON.stringify(value);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > UI_CONTENT_PARAMS_HOST_CONTRACT.maxSerializedBytes) {
    throw new UiContentParamsError(
      `params must not exceed ${UI_CONTENT_PARAMS_HOST_CONTRACT.maxSerializedBytes} serialized bytes.`,
    );
  }
  return value as UiContentParams;
}

export function createUiContentParamsWindowName(
  params: UiContentParams | undefined,
): string | undefined {
  const normalized = readUiContentParams(params);
  return normalized
    ? `${UI_CONTENT_PARAMS_HOST_CONTRACT.windowNamePrefix}${JSON.stringify(normalized)}`
    : undefined;
}

export function appendUiContentParamsBootstrapQuery(
  url: string,
  params: UiContentParams | undefined,
): string {
  if (!readUiContentParams(params)) {
    return url;
  }
  const [withoutHash, hash] = url.split("#", 2);
  const queryStart = withoutHash.indexOf("?");
  const pathname =
    queryStart >= 0 ? withoutHash.slice(0, queryStart) : withoutHash;
  const query = new URLSearchParams(
    queryStart >= 0 ? withoutHash.slice(queryStart + 1) : "",
  );
  query.set(
    UI_CONTENT_PARAMS_HOST_CONTRACT.bootstrapQueryParam,
    UI_CONTENT_PARAMS_HOST_CONTRACT.bootstrapQueryValue,
  );
  return `${pathname}?${query.toString()}${
    typeof hash === "string" ? `#${hash}` : ""
  }`;
}
