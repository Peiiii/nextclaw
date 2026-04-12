import { describe, expect, it } from "vitest";
import { validateToolArgs } from "../utils.js";

describe("validateToolArgs", () => {
  it("validates a flat object schema with additionalProperties false", () => {
    const schema = {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
      additionalProperties: false,
    };

    expect(validateToolArgs({ path: "/tmp/a.txt" }, schema)).toEqual([]);
    expect(validateToolArgs({ file_path: "/tmp/a.txt" }, schema)).toContain(
      "file_path is not allowed",
    );
    expect(validateToolArgs({}, schema)).toContain("path is required");
  });

  it("returns no issues when no schema is provided", () => {
    expect(validateToolArgs({ anything: true }, undefined)).toEqual([]);
  });
});
