import { describe, expect, it } from "vitest";
import {
  buildOpenAiFunctionTool,
  getOpenAiFunctionParametersSchemaIssues,
} from "../utils.js";

describe("openai tool schema guard", () => {
  it("accepts a root object schema without forbidden top-level keywords", () => {
    expect(
      buildOpenAiFunctionTool({
        name: "asset_put",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            bytesBase64: { type: "string" },
          },
          additionalProperties: false,
        },
      }),
    ).toMatchObject({
      type: "function",
      function: {
        name: "asset_put",
      },
    });
  });

  it("reports unsupported top-level composition keywords", () => {
    expect(
      getOpenAiFunctionParametersSchemaIssues({
        type: "object",
        oneOf: [{ type: "object" }],
      }),
    ).toEqual(['root schema must not declare top-level "oneOf"']);

    expect(() =>
      buildOpenAiFunctionTool({
        name: "asset_put",
        parameters: {
          type: "object",
          oneOf: [{ type: "object" }],
        },
      }),
    ).toThrow(/unsupported OpenAI-compatible parameters schema/);
  });

  it("requires parameters to be declared even for no-arg tools", () => {
    expect(getOpenAiFunctionParametersSchemaIssues(undefined)).toEqual([
      "parameters must be declared as a JSON Schema object",
    ]);

    expect(() =>
      buildOpenAiFunctionTool({
        name: "ping",
      }),
    ).toThrow(/parameters must be declared as a JSON Schema object/);
  });
});
