import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@nextclaw/core";
import { CoreSelfHealService } from "./core-self-heal.service.js";
import type { CoreSelfHealServiceDeps } from "./core-self-heal.service.js";
import type { CoreHealthCheckId, CoreHealthStatus } from "@kernel/features/core-health/index.js";

type SelfHealConfig = NonNullable<Config["coreHealth"]["selfHeal"]>;

function makeConfig(overrides: { selfHeal?: Partial<SelfHealConfig> } = {}): Config {
  return {
    coreHealth: {
      autoDegrade: false,
      selfHeal: {
        enabled: true,
        intervalMs: 30_000,
        failureThreshold: 3,
        maxRepairsPerHour: 3,
        repairCooldownMs: 0,
        ...overrides.selfHeal,
      },
    },
  } as Config;
}

function makeSnapshot(failedIds: CoreHealthCheckId[]): CoreHealthStatus {
  const checkedAt = new Date().toISOString();
  return {
    healthy: failedIds.length === 0,
    checks: ["config", "provider", "workspace", "sessions"].map(
      (id): CoreHealthStatus["checks"][number] => ({
        id: id as CoreHealthCheckId,
        ok: !failedIds.includes(id as CoreHealthCheckId),
        ...(failedIds.includes(id as CoreHealthCheckId) ? { detail: "test-failure" } : {}),
        checkedAt,
      })
    ),
    evaluatedAt: checkedAt,
  };
}

type TestDeps = {
  config: Config;
  failedIds: CoreHealthCheckId[];
  applyConfigReload: () => Promise<void>;
  deps: CoreSelfHealServiceDeps;
};

function createDeps(overrides: Partial<TestDeps> & { selfHeal?: Partial<SelfHealConfig> } = {}): TestDeps {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-core-self-heal-"));
  testDirs.push(rootDir);
  const config = overrides.config ?? makeConfig({ selfHeal: overrides.selfHeal });
  const failedIds = overrides.failedIds ?? [];
  const applyConfigReload = overrides.applyConfigReload ?? (async () => {});
  return {
    config,
    failedIds,
    applyConfigReload,
    deps: {
      getConfig: () => config,
      coreHealthEvaluate: () => makeSnapshot(failedIds),
      applyConfigReload,
      getWorkspacePath: () => join(rootDir, "workspace"),
      sessionsDir: join(rootDir, "sessions"),
    },
  };
}

const testDirs: string[] = [];

describe("CoreSelfHealService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const dir of testDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("evaluate()", () => {
    it("returns disabled before start and never starts a timer when enabled=false", () => {
      const test = createDeps({ selfHeal: { enabled: false } });
      const service = new CoreSelfHealService(test.deps);
      expect(service.evaluate().phase).toBe("disabled");

      service.start();
      const evaluateSpy = vi.spyOn(test.deps, "coreHealthEvaluate");
      vi.advanceTimersByTime(120_000);
      expect(evaluateSpy).not.toHaveBeenCalled();
      expect(service.evaluate().phase).toBe("disabled");
      service.dispose();
    });

    it("returns healthy after the first heartbeat when all checks pass", async () => {
      const test = createDeps();
      const service = new CoreSelfHealService(test.deps);
      service.start();
      await vi.advanceTimersByTimeAsync(30_000);

      const status = service.evaluate();
      expect(status.phase).toBe("healthy");
      expect(status.healthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastHeartbeatAt).toBeDefined();
      expect(status.checks).toHaveLength(4);
      service.dispose();
    });
  });

  describe("heartbeat interval", () => {
    it("fires heartbeats at the configured interval and follows intervalMs changes on next tick", async () => {
      const test = createDeps();
      const service = new CoreSelfHealService(test.deps);
      const evaluateSpy = vi.spyOn(test.deps, "coreHealthEvaluate");
      service.start();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(evaluateSpy).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(evaluateSpy).toHaveBeenCalledTimes(2);

      // 修改配置间隔，下一个 tick 按新间隔重建计时器
      test.config.coreHealth.selfHeal.intervalMs = 10_000;
      await vi.advanceTimersByTimeAsync(30_000); // 旧计时器 30s 到期，tick 内切换到 10s
      expect(evaluateSpy).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(10_000); // 新计时器 10s
      expect(evaluateSpy).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(evaluateSpy).toHaveBeenCalledTimes(5);
      service.dispose();
    });
  });

  describe("consecutive failure tracking", () => {
    it("keeps phase failing below threshold while consecutiveFailures accumulates", async () => {
      const test = createDeps({ failedIds: ["config"] });
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000);
      let status = service.evaluate();
      expect(status.phase).toBe("failing");
      expect(status.failedCheckIds).toEqual(["config"]);
      expect(status.consecutiveFailures).toBe(1);

      await vi.advanceTimersByTimeAsync(30_000);
      status = service.evaluate();
      expect(status.phase).toBe("failing");
      expect(status.consecutiveFailures).toBe(2);
      expect(status.checks.find((c) => c.id === "config")?.consecutiveFailures).toBe(2);
      service.dispose();
    });

    it("confirms degraded once consecutive failures reach the threshold", async () => {
      const test = createDeps({ failedIds: ["config"] });
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(service.evaluate().phase).toBe("failing");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(service.evaluate().phase).toBe("failing");
      await vi.advanceTimersByTimeAsync(30_000);
      const status = service.evaluate();
      expect(status.phase).toBe("degraded");
      expect(status.failedCheckIds).toEqual(["config"]);
      expect(status.consecutiveFailures).toBe(3);
      service.dispose();
    });

    it("returns to healthy on the next heartbeat when the check passes again", async () => {
      const test = createDeps({ failedIds: ["config"] });
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(service.evaluate().phase).toBe("failing");
      // 检查恢复：连续失败计数重置，phase 回 healthy
      test.failedIds.length = 0;
      await vi.advanceTimersByTimeAsync(30_000);
      const status = service.evaluate();
      expect(status.phase).toBe("healthy");
      expect(status.consecutiveFailures).toBe(0);
      expect(status.failedCheckIds).toEqual([]);
      service.dispose();
    });
  });

  describe("repair actions", () => {
    it("triggers config-reload on the next heartbeat after degraded and recovers to healthy", async () => {
      const test = createDeps({ failedIds: ["config"] });
      let reloadCalls = 0;
      test.deps.applyConfigReload = async () => {
        reloadCalls += 1;
        // 修复生效：下一次 evaluate 恢复通过
        test.failedIds.length = 0;
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(90_000);
      expect(service.evaluate().phase).toBe("degraded");
      expect(reloadCalls).toBe(0);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(reloadCalls).toBe(1);
      const status = service.evaluate();
      expect(status.phase).toBe("healthy");
      expect(status.lastRepair?.action).toBe("config-reload");
      expect(status.lastRepair?.recovered).toBe(true);
      expect(status.checks.find((c) => c.id === "config")?.consecutiveFailures).toBe(0);
      service.dispose();
    });

    it("uses directory-ensure for workspace/sessions failures and creates the missing dirs", async () => {
      const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-selfheal-dir-"));
      testDirs.push(rootDir);
      const missingWorkspace = join(rootDir, "missing", "workspace");
      const missingSessions = join(rootDir, "missing", "sessions");
      expect(existsSync(missingWorkspace)).toBe(false);
      expect(existsSync(missingSessions)).toBe(false);

      const test = createDeps({
        failedIds: ["workspace", "sessions"],
        selfHeal: { failureThreshold: 2 },
      });
      test.deps.getWorkspacePath = () => missingWorkspace;
      test.deps.sessionsDir = missingSessions;
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(60_000); // 2 次失败 → degraded
      expect(service.evaluate().phase).toBe("degraded");
      await vi.advanceTimersByTimeAsync(30_000); // 触发修复
      expect(existsSync(missingWorkspace)).toBe(true);
      expect(existsSync(missingSessions)).toBe(true);
      const status = service.evaluate();
      // 修复动作已执行，但注入的快照仍报失败 → repair-exhausted
      expect(status.phase).toBe("repair-exhausted");
      expect(status.lastRepair?.action).toBe("directory-ensure");
      expect(status.lastRepair?.recovered).toBe(false);
      service.dispose();
    });
  });

  describe("rate limit", () => {
    it("skips further repairs within maxRepairsPerHour and records repair-exhausted", async () => {
      const test = createDeps({
        failedIds: ["config"],
        selfHeal: { failureThreshold: 1, maxRepairsPerHour: 1 },
      });
      let reloadCalls = 0;
      test.deps.applyConfigReload = async () => {
        reloadCalls += 1;
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000); // 达阈值 → degraded（不修复）
      expect(service.evaluate().phase).toBe("degraded");
      await vi.advanceTimersByTimeAsync(30_000); // 第 1 次修复
      expect(reloadCalls).toBe(1);
      expect(service.evaluate().phase).toBe("repair-exhausted");

      await vi.advanceTimersByTimeAsync(30_000); // 速率限制内：跳过修复
      expect(reloadCalls).toBe(1);
      expect(service.evaluate().phase).toBe("repair-exhausted");
      service.dispose();
    });

    it("allows new repairs once the one-hour sliding window expires", async () => {
      const test = createDeps({
        failedIds: ["config"],
        selfHeal: { failureThreshold: 1, maxRepairsPerHour: 1 },
      });
      let reloadCalls = 0;
      test.deps.applyConfigReload = async () => {
        reloadCalls += 1;
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(30_000); // 第 1 次修复
      expect(reloadCalls).toBe(1);

      await vi.advanceTimersByTimeAsync(3_600_000); // 超过一小时窗口
      await vi.advanceTimersByTimeAsync(30_000);
      expect(reloadCalls).toBe(2);
      service.dispose();
    });

    it("respects repairCooldownMs between repairs of the same check", async () => {
      const test = createDeps({
        failedIds: ["config"],
        selfHeal: { failureThreshold: 1, repairCooldownMs: 60_000 },
      });
      let reloadCalls = 0;
      test.deps.applyConfigReload = async () => {
        reloadCalls += 1;
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000); // degraded
      await vi.advanceTimersByTimeAsync(30_000); // 第 1 次修复
      expect(reloadCalls).toBe(1);
      await vi.advanceTimersByTimeAsync(30_000); // 冷却 60s 未满 → 跳过
      expect(reloadCalls).toBe(1);
      expect(service.evaluate().phase).toBe("repair-exhausted");
      await vi.advanceTimersByTimeAsync(30_000); // 冷却满 → 第 2 次修复
      expect(reloadCalls).toBe(2);
      service.dispose();
    });
  });

  describe("repair failure handling", () => {
    it("captures repair exceptions, records repair failure, and keeps the heartbeat running", async () => {
      const test = createDeps({
        failedIds: ["provider"],
        selfHeal: { failureThreshold: 1 },
      });
      test.deps.applyConfigReload = async () => {
        throw new Error("boom-reload");
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(30_000); // degraded
      await vi.advanceTimersByTimeAsync(30_000); // 修复抛异常
      const status = service.evaluate();
      expect(status.phase).toBe("repair-exhausted");
      expect(status.lastRepair?.recovered).toBe(false);
      expect(status.lastRepair?.action).toBe("config-reload");

      // 状态机继续运行：再跳一个间隔仍有心跳
      const evaluateSpy = vi.spyOn(test.deps, "coreHealthEvaluate");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(evaluateSpy).toHaveBeenCalled();
      service.dispose();
    });

    it("public snapshot never exposes raw exception details or local paths", async () => {
      const test = createDeps({
        failedIds: ["provider"],
        selfHeal: { failureThreshold: 1 },
      });
      test.deps.applyConfigReload = async () => {
        throw new Error("boom-with-/tmp/sensitive/path");
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(60_000);
      const snapshot = service.toPublicSnapshot();
      expect(snapshot.phase).toBe("repair-exhausted");
      expect(JSON.stringify(snapshot)).not.toContain("boom-with-");
      expect(JSON.stringify(snapshot)).not.toContain("/tmp/");
      service.dispose();
    });

    it("internal evaluate keeps the detail for authenticated diagnostics", async () => {
      const test = createDeps({
        failedIds: ["provider"],
        selfHeal: { failureThreshold: 1 },
      });
      test.deps.applyConfigReload = async () => {
        throw new Error("boom-reload");
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(60_000);
      expect(service.evaluate().lastRepair?.detail).toBe("boom-reload");
      expect(service.toPublicSnapshot().lastRepair?.detail).toBeUndefined();
      service.dispose();
    });
  });

  describe("recovery and reset", () => {
    it("resets consecutiveFailures to zero after a successful repair", async () => {
      const test = createDeps({ failedIds: ["config"] });
      test.deps.applyConfigReload = async () => {
        test.failedIds.length = 0;
      };
      const service = new CoreSelfHealService(test.deps);
      service.start();

      await vi.advanceTimersByTimeAsync(90_000);
      expect(service.evaluate().consecutiveFailures).toBe(3);
      await vi.advanceTimersByTimeAsync(30_000); // 修复成功
      const status = service.evaluate();
      expect(status.phase).toBe("healthy");
      expect(status.consecutiveFailures).toBe(0);
      expect(status.failedCheckIds).toEqual([]);
      service.dispose();
    });
  });

  describe("config hot-swap", () => {
    it("stops the timer on the next tick when enabled flips to false", async () => {
      const test = createDeps();
      const service = new CoreSelfHealService(test.deps);
      service.start();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(service.evaluate().phase).toBe("healthy");

      test.config.coreHealth.selfHeal.enabled = false;
      await vi.advanceTimersByTimeAsync(30_000); // 下一 tick 检测到禁用
      expect(service.evaluate().phase).toBe("disabled");

      const evaluateSpy = vi.spyOn(test.deps, "coreHealthEvaluate");
      await vi.advanceTimersByTimeAsync(120_000);
      expect(evaluateSpy).not.toHaveBeenCalled(); // 计时器已停
      service.dispose();
    });
  });

  describe("dispose", () => {
    it("clears the timer so no further heartbeats fire", async () => {
      const test = createDeps();
      const service = new CoreSelfHealService(test.deps);
      service.start();
      await vi.advanceTimersByTimeAsync(30_000);
      const lastHeartbeat = service.evaluate().lastHeartbeatAt;

      service.dispose();
      const evaluateSpy = vi.spyOn(test.deps, "coreHealthEvaluate");
      await vi.advanceTimersByTimeAsync(120_000);
      expect(evaluateSpy).not.toHaveBeenCalled();
      expect(service.evaluate().lastHeartbeatAt).toBe(lastHeartbeat);
    });
  });
});
