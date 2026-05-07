import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { EditFileTool } from "../tools/filesystem.js";

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
