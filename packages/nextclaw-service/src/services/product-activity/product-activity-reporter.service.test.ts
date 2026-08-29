import type { Config } from "@nextclaw/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductActivityReporter } from "./product-activity-reporter.service.js";

const temporaryDirectories: string[] = [];

function createHome(): string {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-product-activity-"));
  temporaryDirectories.push(home);
  return home;
}

function createConfig(overrides: {
  enabled?: boolean;
  audience?: "external" | "internal" | "qa";
} = {}): Config {
  return {
    productAnalytics: {
      schemaVersion: 2,
      enabled: overrides.enabled ?? true,
      audience: overrides.audience ?? "external",
    },
    providers: {
      nextclaw: {
        apiBase: "https://ai-gateway-api.nextclaw.io/v1",
        apiKey: "nca.must-not-enter-anonymous-analytics.signature",
      },
    },
  } as unknown as Config;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("ProductActivityReporter", () => {
  it("clears local receipt state and the legacy identity when reporting is disabled", async () => {
    const home = createHome();
    const analyticsDirectory = join(home, "product-analytics");
    mkdirSync(analyticsDirectory, { recursive: true });
    writeFileSync(join(analyticsDirectory, "installation.json"), "{}\n");
    writeFileSync(join(analyticsDirectory, "state.json"), "{}\n");
    const fetchImpl = vi.fn<typeof fetch>();
    const reporter = new ProductActivityReporter({
      homeDir: home,
      productVersion: "1.2.3",
      environment: "development",
      releaseChannel: "development",
      loadConfig: () => createConfig({ enabled: false }),
      fetchImpl,
    });

    await reporter.record({
      kind: "intent_accepted",
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "direct",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(existsSync(join(analyticsDirectory, "installation.json"))).toBe(false);
    expect(existsSync(join(analyticsDirectory, "state.json"))).toBe(false);
  });

  it("sends independent day, week, and month receipts without identity or authorization", async () => {
    const home = createHome();
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(null, { status: 202 });
    });
    const reporter = new ProductActivityReporter({
      homeDir: home,
      productVersion: "1.2.3-beta.4",
      environment: "production",
      releaseChannel: "beta",
      loadConfig: () => createConfig({ audience: "qa" }),
      fetchImpl,
      now: () => new Date("2026-08-20T12:05:00.000Z"),
    });

    await reporter.record({
      kind: "intent_accepted",
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "channel",
    });
    await reporter.record({
      kind: "run_succeeded",
      occurredAt: "2026-08-20T12:01:00.000Z",
      source: "channel",
    });

    expect(requests).toHaveLength(6);
    expect(requests.every(({ input }) => input === "https://ai-gateway-api.nextclaw.io/platform/analytics/activity")).toBe(true);
    const bodies = requests.map(({ init }) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(new Set(bodies.map((body) => body.receiptId)).size).toBe(6);
    expect(bodies.map((body) => body.periodKind)).toEqual([
      "day", "week", "month", "day", "week", "month",
    ]);
    expect(bodies.map((body) => body.periodStart)).toEqual([
      "2026-08-20", "2026-08-17", "2026-08-01",
      "2026-08-20", "2026-08-17", "2026-08-01",
    ]);
    expect(bodies[0]).toMatchObject({
      schemaVersion: 2,
      metric: "active",
      audience: "qa",
      environment: "production",
      releaseChannel: "beta",
      appVersion: "1.2",
    });
    expect(bodies[3]).toMatchObject({ metric: "successful" });
    for (const body of bodies) {
      expect(Object.keys(body).sort()).toEqual([
        "appVersion",
        "audience",
        "environment",
        "metric",
        "occurredAt",
        "periodKind",
        "periodStart",
        "platform",
        "receiptId",
        "releaseChannel",
        "schemaVersion",
      ]);
      expect(body).not.toHaveProperty("installationId");
      expect(body).not.toHaveProperty("source");
    }
    expect(requests.every(({ init }) => !new Headers(init?.headers).has("authorization"))).toBe(true);
    expect(reporter.getStatus()).toEqual({
      lastAttemptAt: "2026-08-20T12:05:00.000Z",
      lastSuccessAt: "2026-08-20T12:05:00.000Z",
      lastError: null,
      pendingReceiptCount: 0,
    });
  });

  it("serializes concurrent signals and sends each period metric once", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    const reporter = new ProductActivityReporter({
      homeDir: createHome(),
      productVersion: "1.2.3",
      environment: "development",
      releaseChannel: "development",
      loadConfig: () => createConfig(),
      fetchImpl,
    });
    const signal = {
      kind: "intent_accepted" as const,
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "direct" as const,
    };

    await Promise.all([reporter.record(signal), reporter.record(signal), reporter.record(signal)]);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries non-2xx failures with the same receipt ids and exposes status", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    let succeeds = false;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(null, { status: succeeds ? 202 : 503 });
    });
    const reporter = new ProductActivityReporter({
      homeDir: createHome(),
      productVersion: "1.2.3",
      environment: "development",
      releaseChannel: "development",
      loadConfig: () => createConfig(),
      fetchImpl,
      now: () => new Date("2026-08-20T12:05:00.000Z"),
    });
    const signal = {
      kind: "intent_accepted" as const,
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "direct" as const,
    };

    await reporter.record(signal);
    expect(reporter.getStatus()).toMatchObject({
      lastError: "HTTP 503",
      pendingReceiptCount: 3,
    });
    const failedIds = requestBodies.map((body) => body.receiptId);
    succeeds = true;
    await reporter.record(signal);

    expect(requestBodies.slice(3).map((body) => body.receiptId)).toEqual(failedIds);
    expect(reporter.getStatus()).toMatchObject({
      lastError: null,
      pendingReceiptCount: 0,
    });
    const persisted = JSON.parse(readFileSync(
      join(temporaryDirectories.at(-1)!, "product-analytics", "state.json"),
      "utf8",
    )) as { receipts: Record<string, { deliveredAt: string | null }> };
    expect(Object.values(persisted.receipts).every((receipt) => receipt.deliveredAt !== null)).toBe(true);
  });
});
