import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "../router.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempConfigPath(): string {
  const dir = createTempDir("nextclaw-ui-server-path-config-");
  return join(dir, "config.json");
}

function createTestApp() {
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);
  return createUiRouter({
    configPath,
    publish: () => {},
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ServerPathRoutesController", () => {
  it("browses server directories and filters out files by default", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-root-"));
    mkdirSync(join(root, "alpha"), { recursive: true });
    writeFileSync(join(root, "note.txt"), "hello");

    const response = await app.request(
      `http://localhost/api/server-paths/browse?path=${encodeURIComponent(root)}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        currentPath: string;
        parentPath: string | null;
        entries: Array<{ name: string; kind: string }>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.currentPath).toBe(root);
    expect(payload.data.parentPath).not.toBeNull();
    expect(payload.data.entries).toHaveLength(1);
    expect(payload.data.entries[0]).toMatchObject({
      name: "alpha",
      kind: "directory",
      hidden: false,
    });
  });

  it("returns a validation error when the server path does not exist", async () => {
    const app = createTestApp();

    const response = await app.request(
      "http://localhost/api/server-paths/browse?path=%2Fpath%2Fthat%2Fdoes%2Fnot%2Fexist",
    );

    expect(response.status).toBe(400);
    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error).toEqual({
      code: "SERVER_PATH_NOT_FOUND",
      message: "server path does not exist",
    });
  });

  it("reads a text file preview relative to a base path", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-read-root-"));
    mkdirSync(join(root, "notes"), { recursive: true });
    writeFileSync(join(root, "notes", "todo.md"), "# Todo\n\n- Ship it");

    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent("./notes/todo.md")}&basePath=${encodeURIComponent(root)}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        kind: string;
        resolvedPath: string;
        text?: string;
        truncated: boolean;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.kind).toBe("markdown");
    expect(payload.data.resolvedPath).toBe(join(root, "notes", "todo.md"));
    expect(payload.data.text).toContain("# Todo");
    expect(payload.data.truncated).toBe(false);
  });

  it("returns binary metadata for non-text files instead of forcing a text preview", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-read-binary-"));
    const binaryPath = join(root, "asset.bin");
    writeFileSync(binaryPath, Buffer.from([0, 1, 2, 3, 4]));

    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent(binaryPath)}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        kind: string;
        text?: string;
        sizeBytes: number;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.kind).toBe("binary");
    expect(payload.data.text).toBeUndefined();
    expect(payload.data.sizeBytes).toBe(5);
  });

  it("rejects relative file preview requests when no base path is available", async () => {
    const app = createTestApp();

    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent("./notes/todo.md")}`,
    );

    expect(response.status).toBe(400);
    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error).toEqual({
      code: "SERVER_PATH_BASE_REQUIRED",
      message: "relative server path requires a base path",
    });
  });
});
