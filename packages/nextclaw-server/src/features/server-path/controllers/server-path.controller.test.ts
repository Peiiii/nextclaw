import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { EventBus } from "@nextclaw/shared";

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
    kernel: createRouterTestKernel(),
    configPath,
    appEventBus: new EventBus(),
  });
}

function buildContentUrl(path: string): string {
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `http://localhost/api/server-paths/content/__abs__/${encodedPath}`;
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
    const payload = (await response.json()) as {
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
    const payload = (await response.json()) as {
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

  it("browses server directories relative to a base path", async () => {
    const app = createTestApp();
    const root = realpathSync(
      createTempDir("nextclaw-ui-server-path-browse-base-"),
    );
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "index.ts"), "export const ok = true;");

    const response = await app.request(
      `http://localhost/api/server-paths/browse?path=${encodeURIComponent("./src")}&basePath=${encodeURIComponent(root)}&includeFiles=1`,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        currentPath: string;
        entries: Array<{ name: string; kind: string }>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.currentPath).toBe(join(root, "src"));
    expect(payload.data.entries).toEqual([
      {
        name: "index.ts",
        path: join(root, "src", "index.ts"),
        kind: "file",
        hidden: false,
      },
    ]);
  });

  it("reads a text file preview relative to a base path", async () => {
    const app = createTestApp();
    const root = realpathSync(
      createTempDir("nextclaw-ui-server-path-read-root-"),
    );
    mkdirSync(join(root, "notes"), { recursive: true });
    writeFileSync(join(root, "notes", "todo.md"), "# Todo\n\n- Ship it");

    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent("./notes/todo.md")}&basePath=${encodeURIComponent(root)}`,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
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
    const root = realpathSync(
      createTempDir("nextclaw-ui-server-path-read-binary-"),
    );
    const binaryPath = join(root, "asset.bin");
    writeFileSync(binaryPath, Buffer.from([0, 1, 2, 3, 4]));

    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent(binaryPath)}`,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
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
    const payload = (await response.json()) as {
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

  it("serves a local HTML file as browser content without wrapping it as JSON", async () => {
    const app = createTestApp();
    const root = realpathSync(
      createTempDir("nextclaw-ui-server-path-content-"),
    );
    const htmlPath = join(root, "index.html");
    writeFileSync(
      htmlPath,
      "<!doctype html><script>window.loaded = true;</script>",
    );

    const response = await app.request(buildContentUrl(htmlPath));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toContain(
      "inline; filename*=UTF-8''index.html",
    );
    expect(await response.text()).toContain("window.loaded = true");
  });

  it("serves relative JavaScript assets through the same content route", async () => {
    const app = createTestApp();
    const root = realpathSync(
      createTempDir("nextclaw-ui-server-path-content-assets-"),
    );
    const scriptPath = join(root, "scripts", "app.js");
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(scriptPath, "window.answer = 42;");

    const response = await app.request(buildContentUrl(scriptPath));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/javascript; charset=utf-8",
    );
    expect(await response.text()).toBe("window.answer = 42;");
  });

  it("serves relative file content against an explicit base path", async () => {
    const app = createTestApp();
    const root = realpathSync(
      createTempDir("nextclaw-ui-server-path-relative-content-"),
    );
    const imagePath = join(root, "assets", "logo.svg");
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(
      imagePath,
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>',
    );
    const query = new URLSearchParams({
      path: "assets/logo.svg",
      basePath: root,
    });

    const response = await app.request(
      `http://localhost/api/server-paths/content?${query.toString()}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "image/svg+xml; charset=utf-8",
    );
    expect(await response.text()).toContain("<circle");
  });
});

describe("ServerPathRoutesController Office content", () => {
  it.each([
    [
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "workbook.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ["workbook.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
    [
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ])(
    "serves %s with its Office content type",
    async (fileName, contentType) => {
      const app = createTestApp();
      const root = realpathSync(
        createTempDir("nextclaw-ui-server-path-office-"),
      );
      const filePath = join(root, fileName);
      writeFileSync(filePath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));

      const response = await app.request(buildContentUrl(filePath));

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(contentType);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      );
    },
  );
});

describe("ServerPathRoutesController location reads", () => {
  it("returns a target-centered window with real file line numbers", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-read-location-"));
    const filePath = join(root, "large.txt");
    writeFileSync(
      filePath,
      Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join("\n"),
    );
    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent(filePath)}&line=80`,
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: { startLine: number; text: string; truncated: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: { startLine: 60, truncated: true },
    });
    expect(payload.data.text.startsWith("line 60\n")).toBe(true);
    expect(payload.data.text).toContain("line 80\n");
    expect(payload.data.text).not.toContain("line 59\n");
  });
});
