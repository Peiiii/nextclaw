import { mkdtempSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreHealthCheckService } from "./core-health-check.service.js";
import type { CoreHealthCheckServiceDeps } from "./core-health-check.service.js";

function createDeps(overrides: Partial<CoreHealthCheckServiceDeps> = {}): CoreHealthCheckServiceDeps {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-core-health-"));
  return {
    getConfig: () =>
      ({
        agents: { defaults: { workspace: "" } },
        providers: {
          openai: { enabled: true, apiKey: "sk-test" },
        },
      }) as never,
    getWorkspacePath: () => join(rootDir, "workspace"),
    sessionsDir: join(rootDir, "sessions"),
    ...overrides,
  };
}

describe("CoreHealthCheckService", () => {
  it("reports healthy when all core checks pass", () => {
    const status = new CoreHealthCheckService(createDeps()).evaluate();
    expect(status.healthy).toBe(true);
    expect(status.checks.map((check) => check.id)).toEqual(["config", "provider", "workspace", "sessions"]);
    for (const check of status.checks) {
      expect(check.ok).toBe(true);
      expect(check.detail).toBeUndefined();
      expect(check.checkedAt).toBeTypeOf("string");
    }
    expect(status.evaluatedAt).toBeTypeOf("string");
  });

  it("reports config failure when agents defaults are missing", () => {
    const deps = createDeps();
    const status = new CoreHealthCheckService({
      ...deps,
      getConfig: () => ({ providers: { openai: { enabled: true, apiKey: "sk" } } }) as never,
    }).evaluate();
    const config = status.checks.find((check) => check.id === "config");
    expect(config?.ok).toBe(false);
    expect(config?.detail).toBe("agents defaults are missing");
    expect(status.healthy).toBe(false);
  });

  it("reports provider failure when no enabled provider has an api key", () => {
    const deps = createDeps();
    const status = new CoreHealthCheckService({
      ...deps,
      getConfig: () =>
        ({
          agents: { defaults: { workspace: "" } },
          providers: {
            local: { enabled: true, apiKey: "" },
            openai: { enabled: false, apiKey: "sk-disabled" },
          },
        }) as never,
    }).evaluate();
    const provider = status.checks.find((check) => check.id === "provider");
    expect(provider?.ok).toBe(false);
    expect(provider?.detail).toBe("no-key-configured");
    expect(status.healthy).toBe(false);
  });

  it("reports workspace failure when neither the dir nor its parent is writable", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-core-health-readonly-"));
    const deps = () => createDeps({
      getWorkspacePath: () => join(rootDir, "nested", "workspace"),
      sessionsDir: join(rootDir, "sessions"),
    });
    const before = new CoreHealthCheckService(deps()).evaluate();
    expect(before.checks.find((check) => check.id === "workspace")?.ok).toBe(true);
    chmodSync(rootDir, 0o555);
    try {
      const rechecked = new CoreHealthCheckService(deps()).evaluate();
      const workspace = rechecked.checks.find((check) => check.id === "workspace");
      if (process.getuid?.() === 0) {
        // root 无视文件权限位，无法用 chmod 构造不可写目录
        return;
      }
      expect(workspace?.ok).toBe(false);
      expect(workspace?.detail).toContain("not writable");
    } finally {
      chmodSync(rootDir, 0o755);
    }
  });

  it("keeps evaluate() non-throwing when an injected path accessor throws", () => {
    const deps = createDeps();
    const status = new CoreHealthCheckService({
      ...deps,
      getWorkspacePath: () => {
        throw new Error("transient config reload");
      },
    }).evaluate();
    const workspace = status.checks.find((check) => check.id === "workspace");
    expect(workspace?.ok).toBe(false);
    expect(workspace?.detail).toBe("transient config reload");
    expect(status.healthy).toBe(false);
  });

  it("captures a check exception as a failed result instead of throwing", () => {
    const deps = createDeps();
    const status = new CoreHealthCheckService({
      ...deps,
      getConfig: () => {
        throw new Error("boom");
      },
    }).evaluate();
    const config = status.checks.find((check) => check.id === "config");
    expect(config?.ok).toBe(false);
    expect(config?.detail).toBe("boom");
    expect(status.healthy).toBe(false);
  });

  it("does not cache: two evaluations carry independent timestamps", async () => {
    const service = new CoreHealthCheckService(createDeps());
    const first = service.evaluate();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = service.evaluate();
    expect(second.evaluatedAt >= first.evaluatedAt).toBe(true);
    // 快照逐检查重新取时，不共享同一批 checkedAt
    expect(second.checks.map((check) => check.checkedAt)).not.toEqual(first.checks.map((check) => check.checkedAt));
  });
});
