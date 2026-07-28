import { describe, expect, it } from "vitest";
import {
  appendUiContentParamsBootstrapQuery,
  createUiContentParamsWindowName,
  readUiContentParams,
  UI_CONTENT_PARAMS_HOST_CONTRACT,
} from "./ui-content-params.utils.js";

describe("ui content params", () => {
  it("preserves a nested JSON object and serializes a versioned window name", () => {
    const params = {
      filePath: "/tmp/image.png",
      options: {
        editable: true,
        opacity: 0.75,
      },
      points: [1, 2, null, "three"],
    };

    expect(readUiContentParams(params)).toBe(params);
    expect(createUiContentParamsWindowName(params)).toBe(
      `${UI_CONTENT_PARAMS_HOST_CONTRACT.windowNamePrefix}${JSON.stringify(params)}`,
    );
  });

  it("does not create a window name when params are omitted", () => {
    expect(readUiContentParams(undefined)).toBeUndefined();
    expect(createUiContentParamsWindowName(undefined)).toBeUndefined();
    expect(
      appendUiContentParamsBootstrapQuery(
        "/api/content?version=1#section",
        undefined,
      ),
    ).toBe("/api/content?version=1#section");
  });

  it("adds only the bootstrap marker to the content URL", () => {
    expect(
      appendUiContentParamsBootstrapQuery("/api/content?version=1#section", {
        privateValue: "stays-out-of-the-url",
      }),
    ).toBe("/api/content?version=1&nextclawContentParams=1#section");
    expect(
      appendUiContentParamsBootstrapQuery(
        "/api/content?nextclawContentParams=stale",
        { next: true },
      ),
    ).toBe("/api/content?nextclawContentParams=1");
  });

  it.each([
    ["array root", []],
    ["null root", null],
    ["non-finite number", { value: Number.NaN }],
    ["undefined field", { value: undefined }],
    ["date instance", { value: new Date() }],
  ])("rejects %s", (_label, value) => {
    expect(() => readUiContentParams(value)).toThrow(/params/);
  });

  it("rejects circular references", () => {
    const params: Record<string, unknown> = {};
    params.self = params;

    expect(() => readUiContentParams(params)).toThrow(
      "params must not contain circular references.",
    );
  });

  it("rejects objects over the serialized byte budget", () => {
    const params = {
      value: "界".repeat(UI_CONTENT_PARAMS_HOST_CONTRACT.maxSerializedBytes),
    };

    expect(() => readUiContentParams(params)).toThrow(
      `params must not exceed ${UI_CONTENT_PARAMS_HOST_CONTRACT.maxSerializedBytes} serialized bytes.`,
    );
  });
});
