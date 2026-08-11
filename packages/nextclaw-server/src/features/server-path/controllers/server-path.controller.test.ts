import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { realpath } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, expandHome, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { resolveServerPathLocations } from "@nextclaw-server/features/server-path/utils/server-path-locations.utils.js";
import { resolveServerPath } from "@nextclaw-server/features/server-path/utils/server-path-resolution.utils.js";
import { EventBus, UI_CONTENT_PARAMS_HOST_CONTRACT } from "@nextclaw/shared";

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

describe("Server path platform resolution", () => {
  it("discovers standard home locations from existing server directories", async () => {
    const homePath = createTempDir("nextclaw-ui-server-path-home-");
    mkdirSync(join(homePath, "Desktop"));
    mkdirSync(join(homePath, "Documents"));
    mkdirSync(join(homePath, "Downloads"));

    await expect(resolveServerPathLocations(homePath)).resolves.toEqual(
      expect.arrayContaining([
        { kind: "desktop", path: join(homePath, "Desktop") },
        { kind: "documents", path: join(homePath, "Documents") },
        { kind: "downloads", path: join(homePath, "Downloads") },
      ]),
    );
  });

  it.runIf(process.platform === "linux")("uses Linux XDG user directories before English home defaults", async () => {
    const homePath = createTempDir("nextclaw-ui-server-path-xdg-home-");
    const configPath = createTempDir("nextclaw-ui-server-path-xdg-config-");
    mkdirSync(join(homePath, "Schreibtisch"));
    mkdirSync(join(homePath, "Dokumente"));
    mkdirSync(join(homePath, "Downloads"));
    writeFileSync(
      join(configPath, "user-dirs.dirs"),
      [
        'XDG_DESKTOP_DIR="$HOME/Schreibtisch"',
        'XDG_DOCUMENTS_DIR="$HOME/Dokumente"',
        'XDG_DOWNLOAD_DIR="$HOME/Downloads"',
      ].join("\n"),
    );
    const previousConfigPath = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = configPath;
    try {
      await expect(resolveServerPathLocations(homePath)).resolves.toEqual([
        { kind: "desktop", path: join(homePath, "Schreibtisch") },
        { kind: "documents", path: join(homePath, "Dokumente") },
        { kind: "downloads", path: join(homePath, "Downloads") },
      ]);
    } finally {
      if (previousConfigPath === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = previousConfigPath;
      }
    }
  });

  it.runIf(process.platform === "win32")("accepts Windows drive, UNC, home, and OneDrive paths", async () => {
    expect(resolveServerPath({ path: "C:\\Windows" })).toBe(resolve("C:\\Windows"));
    expect(resolveServerPath({ path: "\\\\server\\share\\folder" })).toBe(resolve("\\\\server\\share\\folder"));
    expect(expandHome("~\\workspace")).toBe(resolve(homedir(), "workspace"));

    const homePath = createTempDir("nextclaw-ui-server-path-windows-home-");
    const oneDrivePath = createTempDir("nextclaw-ui-server-path-onedrive-");
    mkdirSync(join(oneDrivePath, "Desktop"));
    mkdirSync(join(oneDrivePath, "Documents"));
    const previousOneDrivePath = process.env.OneDrive;
    process.env.OneDrive = oneDrivePath;
    try {
      await expect(resolveServerPathLocations(homePath)).resolves.toEqual([
        { kind: "desktop", path: join(oneDrivePath, "Desktop") },
        { kind: "documents", path: join(oneDrivePath, "Documents") },
      ]);
    } finally {
      if (previousOneDrivePath === undefined) {
        delete process.env.OneDrive;
      } else {
        process.env.OneDrive = previousOneDrivePath;
      }
    }
  });
});

describe("ServerPathRoutesController", () => {
  it("browses server directories and filters out files by default", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-root-"));
    mkdirSync(join(root, "alpha"), { recursive: true });
    writeFileSync(join(root, "note.txt"), "hello");

    const response = await app.request(`http://localhost/api/server-paths/browse?path=${encodeURIComponent(root)}`);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        currentPath: string;
        parentPath: string | null;
        entries: Array<{ name: string; kind: string }>;
        locations: Array<{ kind: string; path: string }>;
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
    expect(payload.data.locations.every((location) => isAbsolute(location.path))).toBe(true);
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
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-browse-base-"));
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
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-read-root-"));
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
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-read-binary-"));
    const binaryPath = join(root, "asset.bin");
    writeFileSync(binaryPath, Buffer.from([0, 1, 2, 3, 4]));

    const response = await app.request(`http://localhost/api/server-paths/read?path=${encodeURIComponent(binaryPath)}`);

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
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-content-"));
    const htmlPath = join(root, "index.html");
    writeFileSync(htmlPath, "<!doctype html><script>window.loaded = true;</script>");

    const response = await app.request(buildContentUrl(htmlPath));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("inline; filename*=UTF-8''index.html");
    expect(await response.text()).toContain("window.loaded = true");
  });

  it("serves relative JavaScript assets through the same content route", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-content-assets-"));
    const scriptPath = join(root, "scripts", "app.js");
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(scriptPath, "window.answer = 42;");

    const response = await app.request(buildContentUrl(scriptPath));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
    expect(await response.text()).toBe("window.answer = 42;");
  });

  it("serves relative file content against an explicit base path", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-relative-content-"));
    const imagePath = join(root, "assets", "logo.svg");
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(imagePath, '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>');
    const query = new URLSearchParams({
      path: "assets/logo.svg",
      basePath: root,
    });

    const response = await app.request(`http://localhost/api/server-paths/content?${query.toString()}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(await response.text()).toContain("<circle");
  });
});

describe("rendered HTML content params", () => {
  it("injects the params bootstrap only when rendered HTML opts in", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-content-params-"));
    const htmlPath = join(root, "index.html");
    writeFileSync(htmlPath, "<!doctype html><html><head><script>window.author = true;</script></head></html>");
    const markedUrl = new URL(buildContentUrl(htmlPath));
    markedUrl.searchParams.set(
      UI_CONTENT_PARAMS_HOST_CONTRACT.bootstrapQueryParam,
      UI_CONTENT_PARAMS_HOST_CONTRACT.bootstrapQueryValue,
    );

    const plainHtml = await (await app.request(buildContentUrl(htmlPath))).text();
    const bootstrappedHtml = await (await app.request(markedUrl)).text();

    expect(plainHtml).not.toContain("nextclaw:content-params:bootstrap");
    expect(bootstrappedHtml).toContain("nextclaw:content-params:bootstrap");
    expect(bootstrappedHtml.indexOf("nextclaw:content-params:bootstrap")).toBeLessThan(
      bootstrappedHtml.indexOf("window.author = true"),
    );
    expect(bootstrappedHtml).not.toContain("/tmp/photo.png");
  });
});

describe("server path project search", () => {
  it("searches project files and directories without traversing dependency folders", async () => {
    const app = createTestApp();
    const root = await realpath(createTempDir("nextclaw-ui-server-path-search-"));
    mkdirSync(join(root, "src", "shared"), { recursive: true });
    mkdirSync(join(root, "node_modules", "hidden-package"), {
      recursive: true,
    });
    writeFileSync(join(root, "src", "server-path-search.ts"), "export {};");
    writeFileSync(join(root, "src", "shared", "path-search.test.ts"), "test('ok', () => {});");
    writeFileSync(join(root, "node_modules", "hidden-package", "path-search.js"), "");

    const query = new URLSearchParams({ basePath: root, query: "path-search" });
    const response = await app.request(`http://localhost/api/server-paths/search?${query.toString()}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        basePath: root,
        query: "path-search",
        entries: [
          {
            name: "path-search.test.ts",
            relativePath: "src/shared/path-search.test.ts",
            parentRelativePath: "src/shared",
            kind: "file",
          },
          {
            name: "server-path-search.ts",
            relativePath: "src/server-path-search.ts",
            parentRelativePath: "src",
            kind: "file",
          },
        ],
      },
    });
  });

  it("returns only project-root children for an empty path search", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-search-root-"));
    mkdirSync(join(root, "src", "nested"), { recursive: true });
    writeFileSync(join(root, "README.md"), "read me");
    writeFileSync(join(root, "src", "nested", "hidden.ts"), "");

    const query = new URLSearchParams({ basePath: root });
    const response = await app.request(`http://localhost/api/server-paths/search?${query.toString()}`);

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        entries: [
          { relativePath: "src", kind: "directory" },
          { relativePath: "README.md", kind: "file" },
        ],
        truncated: false,
      },
    });
  });

  it("excludes symlink search results that resolve outside the project root", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-search-boundary-"));
    const external = realpathSync(createTempDir("nextclaw-ui-server-path-search-external-"));
    writeFileSync(join(external, "secret-reference.txt"), "secret");
    symlinkSync(external, join(root, "external-link"), process.platform === "win32" ? "junction" : "dir");

    const query = new URLSearchParams({
      basePath: root,
      query: "secret-reference",
    });
    const response = await app.request(`http://localhost/api/server-paths/search?${query.toString()}`);

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { entries: [] },
    });
  });
});

describe("server path directory creation", () => {
  it("creates a directory inside the current server path", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-create-"));

    const response = await app.request("http://localhost/api/server-paths/directory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentPath: root, name: "new-folder" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { path: join(root, "new-folder") },
    });
    expect(realpathSync(join(root, "new-folder"))).toBe(join(root, "new-folder"));
  });

  it("rejects directory names that can escape the selected parent", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-invalid-name-"));

    const response = await app.request("http://localhost/api/server-paths/directory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentPath: root, name: "../escape" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "SERVER_PATH_DIRECTORY_NAME_INVALID" },
    });
  });

  it("keeps project-scoped directory creation inside the project root", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-create-base-"));
    const external = realpathSync(createTempDir("nextclaw-ui-server-path-create-external-"));

    const response = await app.request("http://localhost/api/server-paths/directory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePath: root,
        parentPath: external,
        name: "escape",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "SERVER_PATH_PARENT_INVALID" },
    });
    expect(existsSync(join(external, "escape"))).toBe(false);
  });

  it("preserves the browsed parent path spelling for the created directory", async () => {
    const app = createTestApp();
    const root = createTempDir("nextclaw-ui-server-path-alias-");
    const actualParent = join(root, "actual");
    const aliasParent = join(root, "alias");
    mkdirSync(actualParent);
    symlinkSync(actualParent, aliasParent, process.platform === "win32" ? "junction" : "dir");

    const response = await app.request("http://localhost/api/server-paths/directory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentPath: aliasParent, name: "new-folder" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { path: join(aliasParent, "new-folder") },
    });

    const browseResponse = await app.request(
      `http://localhost/api/server-paths/browse?path=${encodeURIComponent(aliasParent)}`,
    );
    await expect(browseResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        entries: [{ name: "new-folder", path: join(aliasParent, "new-folder") }],
      },
    });
  });
});

describe("server path project file mutations", () => {
  it("creates an empty file without overwriting and renames it in place", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-create-file-"));

    const createResponse = await app.request("http://localhost/api/server-paths/file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePath: root,
        parentPath: root,
        name: "notes.md",
      }),
    });
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      ok: true,
      data: { name: "notes.md", path: join(root, "notes.md"), kind: "file" },
    });
    expect(readFileSync(join(root, "notes.md"), "utf8")).toBe("");

    const conflictResponse = await app.request("http://localhost/api/server-paths/file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePath: root,
        parentPath: root,
        name: "notes.md",
      }),
    });
    expect(conflictResponse.status).toBe(409);

    const renameResponse = await app.request("http://localhost/api/server-paths/entry", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePath: root,
        path: join(root, "notes.md"),
        name: "ideas.md",
      }),
    });
    expect(renameResponse.status).toBe(200);
    await expect(renameResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        oldPath: join(root, "notes.md"),
        path: join(root, "ideas.md"),
        name: "ideas.md",
        kind: "file",
      },
    });
    expect(existsSync(join(root, "notes.md"))).toBe(false);
    expect(existsSync(join(root, "ideas.md"))).toBe(true);
  });

  it("rejects file creation and rename outside the project root", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-entry-base-"));
    const external = realpathSync(createTempDir("nextclaw-ui-server-path-entry-external-"));
    writeFileSync(join(external, "outside.txt"), "outside");

    const createResponse = await app.request("http://localhost/api/server-paths/file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePath: root,
        parentPath: external,
        name: "escape.txt",
      }),
    });
    expect(createResponse.status).toBe(400);
    expect(existsSync(join(external, "escape.txt"))).toBe(false);

    const renameResponse = await app.request("http://localhost/api/server-paths/entry", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePath: root,
        path: join(external, "outside.txt"),
        name: "renamed.txt",
      }),
    });
    expect(renameResponse.status).toBe(400);
    expect(existsSync(join(external, "outside.txt"))).toBe(true);
  });

  it("uploads multiple files, reports conflicts, and overwrites only when requested", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-upload-"));
    const target = join(root, "assets");
    mkdirSync(target);

    const upload = async (overwrite: boolean, note = "first") => {
      const formData = new FormData();
      formData.append("basePath", root);
      formData.append("targetPath", target);
      formData.append("overwrite", String(overwrite));
      formData.append("files", new File([note], "note.txt"));
      formData.append("files", new File(["image"], "image.svg"));
      return await app.request("http://localhost/api/server-paths/files", {
        method: "POST",
        body: formData,
      });
    };

    const firstResponse = await upload(false);
    expect(firstResponse.status).toBe(201);
    await expect(firstResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        files: [
          { name: "note.txt", path: join(target, "note.txt"), sizeBytes: 5 },
          { name: "image.svg", path: join(target, "image.svg"), sizeBytes: 5 },
        ],
        overwritten: false,
      },
    });

    const conflictResponse = await upload(false, "second");
    expect(conflictResponse.status).toBe(409);
    await expect(conflictResponse.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "SERVER_PATH_FILE_EXISTS",
        details: { conflicts: ["note.txt", "image.svg"] },
      },
    });
    expect(readFileSync(join(target, "note.txt"), "utf8")).toBe("first");

    const overwriteResponse = await upload(true, "second");
    expect(overwriteResponse.status).toBe(201);
    await expect(overwriteResponse.json()).resolves.toMatchObject({
      ok: true,
      data: { overwritten: true },
    });
    expect(readFileSync(join(target, "note.txt"), "utf8")).toBe("second");
  });

  it("deletes files and non-empty directories but protects the project root", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-delete-"));
    const directory = join(root, "generated");
    const file = join(root, "report.md");
    mkdirSync(directory);
    writeFileSync(join(directory, "nested.txt"), "nested");
    writeFileSync(file, "report");

    const deletePath = async (path: string) => {
      const query = new URLSearchParams({ basePath: root, path });
      return await app.request(`http://localhost/api/server-paths/entry?${query.toString()}`, { method: "DELETE" });
    };

    const fileResponse = await deletePath(file);
    expect(fileResponse.status).toBe(200);
    await expect(fileResponse.json()).resolves.toMatchObject({
      ok: true,
      data: { path: file, kind: "file" },
    });
    expect(existsSync(file)).toBe(false);

    const directoryResponse = await deletePath(directory);
    expect(directoryResponse.status).toBe(200);
    await expect(directoryResponse.json()).resolves.toMatchObject({
      ok: true,
      data: { path: directory, kind: "directory" },
    });
    expect(existsSync(directory)).toBe(false);

    const rootResponse = await deletePath(root);
    expect(rootResponse.status).toBe(400);
    await expect(rootResponse.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "SERVER_PATH_ROOT_PROTECTED" },
    });
    expect(existsSync(root)).toBe(true);
  });

  it("rejects upload targets outside the project root", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-upload-base-"));
    const external = realpathSync(createTempDir("nextclaw-ui-server-path-upload-external-"));
    const formData = new FormData();
    formData.append("basePath", root);
    formData.append("targetPath", external);
    formData.append("files", new File(["secret"], "escape.txt"));

    const response = await app.request("http://localhost/api/server-paths/files", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "SERVER_PATH_OUTSIDE_BASE" },
    });
    expect(existsSync(join(external, "escape.txt"))).toBe(false);
  });
});

describe("ServerPathRoutesController Office content", () => {
  it.each([
    ["report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["workbook.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["workbook.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ])("serves %s with its Office content type", async (fileName, contentType) => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-server-path-office-"));
    const filePath = join(root, fileName);
    writeFileSync(filePath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const response = await app.request(buildContentUrl(filePath));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(contentType);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });
});

describe("ServerPathRoutesController location reads", () => {
  it("keeps a targeted file complete when it fits within the preview limit", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-read-location-"));
    const filePath = join(root, "small.txt");
    writeFileSync(filePath, Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join("\n"));
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
      data: { startLine: 1, truncated: false },
    });
    expect(payload.data.text.startsWith("line 1\n")).toBe(true);
    expect(payload.data.text).toContain("line 80\n");
  });

  it("returns a target-centered window for files above the preview limit", async () => {
    const app = createTestApp();
    const root = realpathSync(createTempDir("nextclaw-ui-read-location-large-"));
    const filePath = join(root, "large.txt");
    const fileText = Array.from({ length: 30_000 }, (_, index) => `line ${index + 1} xxxxxxxx`).join("\n");
    expect(Buffer.byteLength(fileText)).toBeGreaterThan(200_000);
    writeFileSync(filePath, fileText);

    const response = await app.request(
      `http://localhost/api/server-paths/read?path=${encodeURIComponent(filePath)}&line=25000`,
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: { startLine: number; text: string; truncated: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: { startLine: 24_980, truncated: true },
    });
    expect(payload.data.text.startsWith("line 24980 xxxxxxxx\n")).toBe(true);
    expect(payload.data.text).toContain("line 25000 xxxxxxxx\n");
    expect(payload.data.text).not.toContain("line 24979 xxxxxxxx\n");
  });
});
