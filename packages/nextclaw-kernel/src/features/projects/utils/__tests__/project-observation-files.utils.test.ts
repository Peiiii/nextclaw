import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanProjectArtifactFiles } from "@kernel/features/projects/utils/project-observation-files.utils.js";

let projectRoot: string | null = null;

afterEach(async () => {
  if (projectRoot) {
    await rm(projectRoot, { recursive: true, force: true });
    projectRoot = null;
  }
});

describe("scanProjectArtifactFiles", () => {
  it("scans configured artifact directories without spending the artifact limit on unrelated files", async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "nextclaw-project-observation-"));
    const unrelatedDirectory = join(projectRoot, "aaa-unrelated");
    const artifactDirectory = join(projectRoot, "docs", "designs");
    await Promise.all([mkdir(unrelatedDirectory), mkdir(artifactDirectory, { recursive: true })]);
    await Promise.all(Array.from({ length: 2_001 }, async (_, index) =>
      await writeFile(join(unrelatedDirectory, `${index}.txt`), "irrelevant")));
    await writeFile(join(artifactDirectory, "project-observer.md"), "# Project observer");

    const result = await scanProjectArtifactFiles(projectRoot, [{
      id: "designs",
      label: "Designs",
      include: ["docs/designs/**/*.md"],
    }]);

    expect(result.issues).toEqual([]);
    expect(result.matches).toEqual([expect.objectContaining({
      createdAt: expect.any(String),
      relativePath: "docs/designs/project-observer.md",
      categoryId: "designs",
      updatedAt: expect.any(String),
    })]);
  });

  it("uses the first configured category when rules overlap", async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "nextclaw-project-observation-"));
    const artifactDirectory = join(projectRoot, "docs", "designs");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(join(artifactDirectory, "project-observer.md"), "# Project observer");

    const result = await scanProjectArtifactFiles(projectRoot, [
      { id: "documents", label: "Documents", include: ["docs/**/*.md"] },
      { id: "designs", label: "Designs", include: ["docs/designs/**/*.md"] },
    ]);

    expect(result.matches).toEqual([expect.objectContaining({
      relativePath: "docs/designs/project-observer.md",
      categoryId: "documents",
    })]);
  });

  it("keeps the most recently updated matching artifacts when a scan reaches its limit", async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "nextclaw-project-observation-"));
    const artifactDirectory = join(projectRoot, "docs", "logs");
    await mkdir(artifactDirectory, { recursive: true });
    const old = join(artifactDirectory, "old.md");
    const recent = join(artifactDirectory, "recent.md");
    const newest = join(artifactDirectory, "newest.md");
    await Promise.all([writeFile(old, "old"), writeFile(recent, "recent"), writeFile(newest, "newest")]);
    await Promise.all([
      utimes(old, new Date("2024-01-01"), new Date("2024-01-01")),
      utimes(recent, new Date("2025-01-01"), new Date("2025-01-01")),
      utimes(newest, new Date("2026-01-01"), new Date("2026-01-01")),
    ]);

    const result = await scanProjectArtifactFiles(projectRoot, [{
      id: "logs",
      label: "Logs",
      include: ["docs/logs/**/*.md"],
    }], { maxArtifactFiles: 2 });

    expect(result.matches.map((match) => match.relativePath)).toEqual(expect.arrayContaining([
      "docs/logs/newest.md",
      "docs/logs/recent.md",
    ]));
    expect(result.matches.map((match) => match.relativePath)).not.toContain("docs/logs/old.md");
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "PROJECT_ARTIFACT_SCAN_LIMIT",
        message: "Showing the 2 most recently updated files out of 3 matched artifacts.",
      }),
    ]));
  });
});
