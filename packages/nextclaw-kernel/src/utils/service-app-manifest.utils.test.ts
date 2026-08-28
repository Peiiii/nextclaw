import { describe, expect, it } from "vitest";
import { AppPlatformTargetService } from "@nextclaw/app-runtime";
import { parseServiceAppManifest } from "./service-app-manifest.utils.js";

const BASE_MANIFEST = {
  id: "native-todo",
  title: "Native Todo",
  enabled: true,
  protocol: "mcp",
  actions: {
    list_todos: { risk: "read" },
  },
};

describe("parseServiceAppManifest target launch", () => {
  it("parses a portable WASI component without a native launch command", () => {
    expect(parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
    }))).toMatchObject({
      protocol: "wasi-component",
      componentEntry: "service.wasm",
      command: undefined,
      args: undefined,
    });
  });

  it("parses a portable action execution budget and rejects unsafe values", () => {
    expect(parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      actions: { run: { risk: "dangerous", timeoutMs: 1_200 } },
    })).actions.run).toMatchObject({ timeoutMs: 1_200 });

    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      actions: { run: { timeoutMs: 10 } },
    }))).toThrow("timeoutMs must be an integer between 100 and 300000");
  });

  it("parses an explicit resident lifecycle and rejects native or unsafe intervals", () => {
    expect(parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      lifecycle: { mode: "resident", eventIntervalMs: 1_000 },
    })).lifecycle).toEqual({ mode: "resident", eventIntervalMs: 1_000 });

    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      command: "node",
      lifecycle: { mode: "resident", eventIntervalMs: 1_000 },
    }))).toThrow("requires wasi-component protocol");
    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      lifecycle: { mode: "resident", eventIntervalMs: 100 },
    }))).toThrow("between 250 and 60000");
  });

  it("parses provider registration and explicit consumer dependencies", () => {
    expect(parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      lifecycle: { mode: "provider" },
      providers: ["contact-provider", "contact-provider"],
    }))).toMatchObject({
      lifecycle: { mode: "provider" },
      providerIds: ["contact-provider"],
    });

    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      command: "node",
      lifecycle: { mode: "provider" },
    }))).toThrow("provider service app lifecycle requires wasi-component protocol");
    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      providers: ["Not Valid"],
    }))).toThrow("kebab-case service app ids");
  });

  it("rejects portable component entries that escape the package", () => {
    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      protocol: "wasi-component",
      component: { entry: "../service.wasm" },
    }))).toThrow("package-relative path");
  });

  it("keeps the existing universal command contract", () => {
    expect(parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      command: "node",
      args: ["server.mjs"],
    }))).toMatchObject({
      command: "node",
      args: ["server.mjs"],
    });
  });

  it("resolves one target from a multi-target local manifest", () => {
    const targetService = new AppPlatformTargetService();
    const manifest = parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      launch: {
        targets: [
          {
            target: { kind: "native", os: "darwin", arch: "arm64" },
            command: "./bin/darwin-arm64/native-todo",
            args: ["--stdio"],
          },
          {
            target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
            command: "./bin/linux-x64-gnu/native-todo",
            args: [],
          },
        ],
      },
    }), {
      target: targetService.parseTargetKey("linux-x64-gnu") as ReturnType<AppPlatformTargetService["readHostTarget"]>,
      platformTargetService: targetService,
    });

    expect(manifest.command).toBe("./bin/linux-x64-gnu/native-todo");
    expect(manifest.args).toEqual([]);
  });

  it("supports a Service App that declares only one platform", () => {
    const targetService = new AppPlatformTargetService();
    const manifest = parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      launch: {
        targets: [
          {
            target: { kind: "native", os: "win32", arch: "x64", abi: "msvc" },
            command: ".\\native-todo.exe",
            args: [],
          },
        ],
      },
    }), {
      target: targetService.parseTargetKey("win32-x64-msvc") as ReturnType<AppPlatformTargetService["readHostTarget"]>,
      platformTargetService: targetService,
    });

    expect(manifest.command).toBe(".\\native-todo.exe");
  });

  it("rejects ambiguous launch declarations and unsupported hosts", () => {
    const targetService = new AppPlatformTargetService();
    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      command: "node",
      launch: { targets: [] },
    }))).toThrow("必须且只能声明");

    expect(() => parseServiceAppManifest(JSON.stringify({
      ...BASE_MANIFEST,
      launch: {
        targets: [
          {
            target: { kind: "native", os: "darwin", arch: "arm64" },
            command: "./native-todo",
          },
        ],
      },
    }), {
      target: targetService.parseTargetKey("linux-arm64-musl") as ReturnType<AppPlatformTargetService["readHostTarget"]>,
      platformTargetService: targetService,
    })).toThrow("不支持当前 target：linux-arm64-musl");
  });
});
