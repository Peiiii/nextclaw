import type { Config } from "@nextclaw/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  apiKey?: string;
} = {}): Config {
  return {
    productAnalytics: {
      enabled: overrides.enabled ?? true,
      audience: overrides.audience ?? "external",
    },
    providers: {
      nextclaw: {
        apiBase: "https://ai-gateway-api.nextclaw.io/v1",
        apiKey: overrides.apiKey ?? "nc_free_not-a-session",
      },
    },
  } as unknown as Config;
}

function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1_000) + 3_600,
  })).toString("base64url");
  return `nca.${payload}.signature`;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("ProductActivityReporter", () => {
  it("does nothing and creates no identity when reporting is disabled", async () => {
    const home = createHome();
    const fetchImpl = vi.fn<typeof fetch>();
    const reporter = new ProductActivityReporter({
      homeDir: home,
      productVersion: "1.2.3",
      loadConfig: () => createConfig({ enabled: false }),
      fetchImpl,
    });

    await reporter.record({
      kind: "intent_accepted",
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "direct",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(existsSync(join(home, "product-analytics", "installation.json"))).toBe(false);
  });

  it("persists a random installation id and sends only the fixed schema", async () => {
    const home = createHome();
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(null, { status: 202 });
    });
    const options = {
      homeDir: home,
      productVersion: "1.2.3",
      loadConfig: () => createConfig({ audience: "qa", apiKey: createSessionToken() }),
      env: {
        NODE_ENV: "production",
        NEXTCLAW_UPDATE_CHANNEL: "beta",
      },
      fetchImpl,
    };

    await new ProductActivityReporter(options).record({
      kind: "intent_accepted",
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "channel",
    });
    await new ProductActivityReporter(options).record({
      kind: "run_succeeded",
      occurredAt: "2026-08-20T12:01:00.000Z",
      source: "channel",
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]?.input).toBe("https://ai-gateway-api.nextclaw.io/platform/analytics/activity");
    const firstBody = JSON.parse(String(requests[0]?.init?.body)) as Record<string, unknown>;
    const secondBody = JSON.parse(String(requests[1]?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(firstBody).sort()).toEqual([
      "appVersion",
      "audience",
      "environment",
      "event",
      "installationId",
      "occurredAt",
      "platform",
      "releaseChannel",
      "schemaVersion",
      "source",
    ]);
    expect(firstBody).toMatchObject({
      audience: "qa",
      environment: "production",
      event: "intent_accepted",
      releaseChannel: "beta",
      source: "channel",
    });
    expect(secondBody.installationId).toBe(firstBody.installationId);
    expect(requests[0]?.init?.headers).toBeInstanceOf(Headers);
    expect((requests[0]?.init?.headers as Headers).get("authorization")).toMatch(/^Bearer nca\./);
    const persisted = JSON.parse(readFileSync(
      join(home, "product-analytics", "installation.json"),
      "utf8",
    )) as { installationId: string };
    expect(persisted.installationId).toBe(firstBody.installationId);
  });

  it("does not attach free keys and never exposes network failures", async () => {
    const reporter = new ProductActivityReporter({
      homeDir: createHome(),
      productVersion: "1.2.3",
      loadConfig: () => createConfig(),
      fetchImpl: vi.fn<typeof fetch>(async (_input, init) => {
        expect((init?.headers as Headers).has("authorization")).toBe(false);
        throw new Error("offline");
      }),
    });

    await expect(reporter.record({
      kind: "run_succeeded",
      occurredAt: "2026-08-20T12:00:00.000Z",
      source: "direct",
    })).resolves.toBeUndefined();
  });
});
