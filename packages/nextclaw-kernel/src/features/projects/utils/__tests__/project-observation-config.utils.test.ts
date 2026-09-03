import { describe, expect, it } from "vitest";
import { parseProjectObservationConfig } from "@kernel/features/projects/utils/project-observation-config.utils.js";

describe("parseProjectObservationConfig", () => {
  it("parses context, artifacts and skill roots", () => {
    const result = parseProjectObservationConfig(`
schema_version: 1
project:
  summary: Long-running research
  context:
    - id: vision
      role: Vision
      source: docs/VISION.md
observation:
  artifacts:
    - id: reports
      label: Reports
      include:
        - reports/**/*.md
  skills:
    - root: .agents/skills
`);

    expect(result.issues).toEqual([]);
    expect(result.config).toMatchObject({
      summary: "Long-running research",
      context: [{ id: "vision", role: "Vision", source: "docs/VISION.md" }],
      artifactCategories: [{ id: "reports", include: ["reports/**/*.md"] }],
      skillRoots: [".agents/skills"],
    });
  });

  it("treats removed workflow and marker fields as unknown", () => {
    const result = parseProjectObservationConfig(`
schema_version: 1
workflows: []
observation:
  markers: []
`);

    expect(result.config).not.toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "PROJECT_CONFIG_UNKNOWN_FIELD",
        message: expect.stringContaining("workflows"),
      }),
      expect.objectContaining({
        code: "PROJECT_CONFIG_UNKNOWN_FIELD",
        message: expect.stringContaining("markers"),
      }),
    ]);
  });

  it("rejects unsupported versions without inventing a fallback config", () => {
    const result = parseProjectObservationConfig("schema_version: 2\n");

    expect(result.config).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_CONFIG_VERSION_UNSUPPORTED" }),
    ]));
  });

  it("reports unknown fields", () => {
    const result = parseProjectObservationConfig("schema_version: 1\nfuture: true\n");

    expect(result.config).not.toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_CONFIG_UNKNOWN_FIELD" }),
    ]));
  });

  it("rejects invented policy fields instead of silently treating them as observation rules", () => {
    const result = parseProjectObservationConfig(`
version: 1
authoritative_sources:
  vision:
    - docs/VISION.md
observation_rules:
  artifacts:
    - Only associate files when their body describes a delivery.
markers:
  dynamic_reporting: disabled
`);

    expect(result.config).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_CONFIG_VERSION_UNSUPPORTED" }),
      expect.objectContaining({
        code: "PROJECT_CONFIG_UNKNOWN_FIELD",
        message: expect.stringContaining("authoritative_sources"),
      }),
      expect.objectContaining({
        code: "PROJECT_CONFIG_UNKNOWN_FIELD",
        message: expect.stringContaining("observation_rules"),
      }),
    ]));
  });
});
