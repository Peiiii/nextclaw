import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { EditFileTool, ReadFileTool } from "@core/features/agent/index.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-filesystem-tool-test-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("EditFileTool", () => {
  it("returns structured start-line metadata for successful edits", async () => {
    const workspace = createWorkspace();
    const filePath = join(workspace, "src", "app.ts");
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(
      filePath,
      ["const one = 1;", "const color = 'red';", "const two = 2;"].join("\n"),
      "utf-8",
    );

    const tool = new EditFileTool(workspace);
    const result = await tool.execute({
      path: filePath,
      oldText: "const color = 'red';",
      newText: "const color = 'blue';",
    });

    expect(result).toEqual({
      path: filePath,
      oldStartLine: 2,
      newStartLine: 2,
      message: `Edited ${filePath}`,
    });
    expect(readFileSync(filePath, "utf-8")).toContain("const color = 'blue';");
  });
});

describe("ReadFileTool", () => {
  it("reads the first OpenCode-sized page by default and reports the next offset", async () => {
    const workspace = createWorkspace();
    const filePath = join(workspace, "long.md");
    const lines = Array.from({ length: 2505 }, (_, index) => `line-${index + 1}`);
    writeFileSync(filePath, lines.join("\n"), "utf-8");

    const tool = new ReadFileTool(workspace);
    const result = await tool.execute({ path: filePath });

    expect(result).toContain(`<path>${filePath}</path>`);
    expect(result).toContain("<type>file</type>");
    expect(result).toContain("1: line-1");
    expect(result).toContain("2000: line-2000");
    expect(result).not.toContain("2001: line-2001");
    expect(result).toContain("Showing lines 1-2000 of 2505. Use offset=2001 to continue.");
  });

  it("continues from a one-indexed offset", async () => {
    const workspace = createWorkspace();
    const filePath = join(workspace, "long.md");
    const lines = Array.from({ length: 2505 }, (_, index) => `line-${index + 1}`);
    writeFileSync(filePath, lines.join("\n"), "utf-8");

    const tool = new ReadFileTool(workspace);
    const result = await tool.execute({ path: filePath, offset: 2001 });

    expect(result).toContain("2001: line-2001");
    expect(result).toContain("2505: line-2505");
    expect(result).toContain("End of file - total 2505 lines");
  });

  it("truncates very long lines and caps output at fifty kilobytes", async () => {
    const workspace = createWorkspace();
    const lineFilePath = join(workspace, "wide.md");
    writeFileSync(lineFilePath, "a".repeat(2500), "utf-8");

    const tool = new ReadFileTool(workspace);
    const lineResult = await tool.execute({ path: lineFilePath });

    expect(lineResult).toContain("... (line truncated to 2000 chars)");

    const cappedFilePath = join(workspace, "capped.md");
    const longLines = Array.from({ length: 200 }, (_, index) => `${index + 1}-${"x".repeat(1000)}`);
    writeFileSync(cappedFilePath, longLines.join("\n"), "utf-8");

    const cappedResult = await tool.execute({ path: cappedFilePath });

    expect(cappedResult).toContain("Output capped at 50 KB");
    expect(cappedResult).toContain("Use offset=");
  });
});
