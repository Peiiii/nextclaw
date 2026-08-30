import { describe, expect, it } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppManifestService } from "./app-manifest.service.js";
import { isAppStandaloneManifestBundle } from "#app-runtime/types/app-manifest.types.js";

describe("AppManifestService", () => {
  it("loads the hello-notes example manifest", async () => {
    const service = new AppManifestService();
    const bundle = await service.load(
      path.resolve(process.cwd(), "../../apps/examples/hello-notes"),
    );

    if (!isAppStandaloneManifestBundle(bundle)) {
      throw new Error("Expected standalone manifest bundle.");
    }
    expect(bundle.manifest.id).toBe("nextclaw.hello-notes");
    expect(bundle.manifest.main.kind).toBe("wasm");
    if (bundle.manifest.main.kind !== "wasm") {
      throw new Error("Expected hello-notes to use wasm main.");
    }
    expect(bundle.manifest.main.action).toBe("summarizeNotes");
    expect(bundle.mainEntryPath.endsWith("main/app.wasm")).toBe(true);
    expect(bundle.uiEntryPath.endsWith("ui/index.html")).toBe(true);
  });

  it("loads a wasi-http-component manifest", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-wasi-http-manifest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(path.join(appDirectory, "main"), { recursive: true });
    await mkdir(path.join(appDirectory, "ui"), { recursive: true });
    await writeFile(path.join(appDirectory, "main", "app.wasm"), Buffer.from("00", "hex"));
    await writeFile(path.join(appDirectory, "ui", "index.html"), "");
    await writeFile(
      path.join(appDirectory, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "nextclaw.todo",
        name: "Todo",
        version: "0.1.0",
        main: {
          kind: "wasi-http-component",
          entry: "main/app.wasm",
        },
        ui: {
          entry: "ui/index.html",
        },
      }),
    );

    try {
      const service = new AppManifestService();
      const bundle = await service.load(appDirectory);

      if (!isAppStandaloneManifestBundle(bundle)) {
        throw new Error("Expected standalone manifest bundle.");
      }
      expect(bundle.manifest.main.kind).toBe("wasi-http-component");
      const summary = service.summarize(bundle);
      if (summary.schemaVersion !== 1) {
        throw new Error("Expected standalone manifest summary.");
      }
      expect(summary.mainKind).toBe("wasi-http-component");
      expect(summary.action).toBeUndefined();
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("loads and resolves a schema v2 Panel + Service package", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const bundle = await new AppManifestService().load(appDirectory);
      expect(bundle.manifest.schemaVersion).toBe(2);
      if (bundle.manifest.schemaVersion !== 2 || !("components" in bundle)) {
        throw new Error("Expected component manifest bundle.");
      }
      expect(bundle.components.map((component) => [component.kind, component.id])).toEqual([
        ["panel", "nextclaw-personal-organizer-todos"],
        ["service", "nextclaw-personal-organizer-data"],
      ]);
      expect(bundle.primaryPanelId).toBe("nextclaw-personal-organizer-todos");
      expect(new AppManifestService().resolvePlatformSecurity(bundle.manifest)).toEqual({
        runtimeProfile: "native-process",
        isolation: "full-user",
        hasServiceComponents: true,
        inferred: true,
        permissions: {
          storage: true,
          capabilities: { nativeProcess: true },
        },
      });
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("accepts a schema v2 WASI Service package as host-mediated", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const manifestPath = path.join(appDirectory, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      await writeFile(
        manifestPath,
        JSON.stringify({ ...manifest, runtime: { profile: "wasi" } }),
      );

      const service = new AppManifestService();
      const bundle = await service.load(appDirectory);
      expect(bundle.manifest.schemaVersion).toBe(2);
      if (bundle.manifest.schemaVersion !== 2) throw new Error("Expected schema v2.");
      expect(service.resolvePlatformSecurity(bundle.manifest)).toEqual({
        runtimeProfile: "wasi",
        isolation: "host-mediated",
        hasServiceComponents: true,
        inferred: false,
        permissions: {},
      });
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("rejects overlapping schema v2 component paths", async () => {
    const appDirectory = await createComponentPackage();
    try {
      await writeFile(
        path.join(appDirectory, "manifest.json"),
        JSON.stringify({
          schemaVersion: 2,
          id: "nextclaw.personal-organizer",
          name: "Personal Organizer",
          version: "0.1.0",
          components: [
            { kind: "panel", path: "panels" },
            { kind: "panel", path: "panels/nextclaw-personal-organizer-todos.panel" },
          ],
        }),
      );
      await expect(new AppManifestService().load(appDirectory)).rejects.toThrow(
        "不能重复或重叠",
      );
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a panel-only runtime declaration with a Service component", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const manifestPath = path.join(appDirectory, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      manifest.runtime = { profile: "panel-only" };
      await writeFile(manifestPath, JSON.stringify(manifest));

      await expect(new AppManifestService().load(appDirectory)).rejects.toThrow(
        "panel-only 不能包含 Service",
      );
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("loads a schema v2 package that declares one supported target", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const manifestPath = path.join(appDirectory, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      manifest.distribution = {
        mode: "targeted",
        targets: [
          { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
        ],
      };
      await writeFile(manifestPath, JSON.stringify(manifest));

      const bundle = await new AppManifestService().load(appDirectory);
      expect(bundle.manifest.schemaVersion).toBe(2);
      if (bundle.manifest.schemaVersion !== 2) {
        throw new Error("Expected component manifest bundle.");
      }
      expect(bundle.manifest.distribution).toEqual(manifest.distribution);
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate targets in a schema v2 package", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const manifestPath = path.join(appDirectory, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      manifest.distribution = {
        mode: "targeted",
        targets: [
          { kind: "native", os: "darwin", arch: "arm64" },
          { kind: "native", os: "darwin", arch: "arm64" },
        ],
      };
      await writeFile(manifestPath, JSON.stringify(manifest));

      await expect(new AppManifestService().load(appDirectory)).rejects.toThrow(
        "重复 target",
      );
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });
});

describe("AppManifestService Secret slots", () => {
  it("parses stable Secret slots without accepting Secret values in the manifest", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const manifestPath = path.join(appDirectory, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      await writeFile(
        manifestPath,
        JSON.stringify({
          ...manifest,
          permissions: {
            secrets: [{
              id: "issue-api-token",
              title: "Issue API token",
              description: "Used to read and update the configured issue tracker.",
              required: true,
            }],
          },
        }),
      );

      const bundle = await new AppManifestService().load(appDirectory);
      expect(bundle.manifest.permissions?.secrets).toEqual([{
        id: "issue-api-token",
        title: "Issue API token",
        description: "Used to read and update the configured issue tracker.",
        required: true,
      }]);
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });

  it("rejects malformed and duplicate Secret slot declarations", async () => {
    const appDirectory = await createComponentPackage();
    try {
      const manifestPath = path.join(appDirectory, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      await writeFile(
        manifestPath,
        JSON.stringify({
          ...manifest,
          permissions: {
            secrets: [{
              id: "IssueToken",
              title: "Issue token",
              description: "A token.",
              required: true,
            }],
          },
        }),
      );
      await expect(new AppManifestService().load(appDirectory)).rejects.toThrow(
        "lowercase slot id",
      );

      await writeFile(
        manifestPath,
        JSON.stringify({
          ...manifest,
          permissions: {
            secrets: [
              { id: "issue-token", title: "Issue token", description: "A token.", required: true },
              { id: "issue-token", title: "Second token", description: "Another token.", required: false },
            ],
          },
        }),
      );
      await expect(new AppManifestService().load(appDirectory)).rejects.toThrow("重复 slot id");

      await writeFile(
        manifestPath,
        JSON.stringify({
          ...manifest,
          permissions: {
            secrets: [{
              id: "issue-token",
              title: "Issue token",
              description: "A token.",
              required: true,
              value: "must-not-be-packaged",
            }],
          },
        }),
      );
      await expect(new AppManifestService().load(appDirectory)).rejects.toThrow(
        "只能声明 id、title、description 和 required",
      );
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });
});

async function createComponentPackage(): Promise<string> {
  const appDirectory = path.join(
    tmpdir(),
    `napp-components-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const panelDirectory = path.join(
    appDirectory,
    "panels",
    "nextclaw-personal-organizer-todos.panel",
  );
  const serviceDirectory = path.join(
    appDirectory,
    "services",
    "nextclaw-personal-organizer-data",
  );
  await mkdir(panelDirectory, { recursive: true });
  await mkdir(serviceDirectory, { recursive: true });
  await writeFile(path.join(panelDirectory, "index.html"), "<!doctype html><title>Todo</title>");
  await writeFile(path.join(panelDirectory, "panel-app.json"), JSON.stringify({
    id: "nextclaw-personal-organizer-todos",
    title: "Todo",
    entry: "index.html",
    actions: ["nextclaw-personal-organizer-data.todo-list"],
  }));
  await writeFile(path.join(serviceDirectory, "server.mjs"), "export {};\n");
  await writeFile(path.join(serviceDirectory, "service-app.json"), JSON.stringify({
    id: "nextclaw-personal-organizer-data",
    title: "Personal Organizer Data",
    command: "node",
    args: ["server.mjs"],
    actions: { "todo-list": { risk: "read" } },
  }));
  await writeFile(path.join(appDirectory, "manifest.json"), JSON.stringify({
    schemaVersion: 2,
    id: "nextclaw.personal-organizer",
    name: "Personal Organizer",
    version: "0.1.0",
    presentation: { primaryPanel: "nextclaw-personal-organizer-todos" },
    components: [
      { kind: "panel", path: "panels/nextclaw-personal-organizer-todos.panel" },
      { kind: "service", path: "services/nextclaw-personal-organizer-data" },
    ],
  }));
  return appDirectory;
}
